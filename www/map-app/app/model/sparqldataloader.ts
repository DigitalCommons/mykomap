import {
  Dataset,
  DataLoader,
  DataConsumer,
} from './dataloader';

import {
  InitiativeObj, 
} from './dataservices';

import {
  Config,
} from './config';

import { json } from 'd3';

const getDatasetPhp = require("../../../services/get_dataset.php");
const eventbus = require('../eventbus');

interface SparqlDatasetResponse {
  meta: {
    endpoint?: string;
    default_graph_uri?: string;
    query?: string;
  };
  data: InitiativeObj[];
  status?: "success";
}

export class SparqlDataLoader implements DataLoader {
  private readonly maxInitiativesToLoadPerFrame = 100;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }
    
  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param [String] dataset - the identifier of this dataset
  // @param [DataConsumer] consumer - consumer for the data
  //
  // @returns a promise which resolves when all datasets are fully loaded and processed
  // by the consumer
  async loadDatasets(datasets: Dataset[], consumer: DataConsumer) {
    
    // Launch the dataset loaders asynchronously, obtaining an array of promises
    // for an [<id>, <data>] pair.
    // Make an index of datasetIds to expect to the relevant dataset loader promises
    let outstanding = Object.fromEntries(datasets.map(
      (ds, ix) => [ds.id, this.loadDataset(ds)]
    ));
    
    // Process the data as it arrives, in chunks    
    while(Object.keys(outstanding).length > 0) {
      try {
        const outstandingPromises = Object.values(outstanding);
        const [datasetId, dataset] = await Promise.any(outstandingPromises);
        
        // A dataset has arrived... check it off the list
        delete outstanding[datasetId];
        
        if (dataset !== undefined) { // Skip failed datasets, which will be undefined
          
          // Load initiatives in chunks, to keep the UI responsive
          while(dataset.length > 0) {
            const batch = dataset.splice(0, this.maxInitiativesToLoadPerFrame);

            // Call addInitiatives in the background, to prevent it blocking other processes.
            await (async () => consumer.addBatch(batch))();
          }
          
          // Publish completion event
          eventbus.publish({ topic: "Initiative.datasetLoaded" });
        }
      }
      catch(error) {
        // All promises should succeed, even on error. Therefore this
        // shouldn't normally occur, except possibly if there are no
        // datasets.  Ignore this.
        console.debug("Unexpected exception whilst processing datasets: ", error);
      }
    }

    // Having loaded all we can, finish off
    consumer.complete();
  }

  // Calls this.loadDataset and handles the result, including event emission
  async loadDataset(dataset: Dataset) {
    const result: [string, InitiativeObj[]] | [string, undefined] = [dataset.id, undefined];
    try {
      const response: SparqlDatasetResponse = await this.fetchDataset(dataset);
      console.debug("loaded " + dataset.id + " data", response);

      // Record the dataset's metadata
      dataset.endpoint = response.meta.endpoint;
      dataset.dgu = response.meta.default_graph_uri;
      dataset.query = response.meta.query;

      // Return the dataset id and its data
      result[1] = response.data;
    }
    catch(error) {
      console.error("load " + dataset.id + " data failed", error);
      
      eventbus.publish({
        topic: "Initiative.loadFailed",
        data: { error: error, dataset: dataset.id }
      });

      // Return the default, a failed dataset indicator
    }
    return result;
  }
  
  // Loads the initiatives data for the given dataset (or all of them) from the server.
  //
  // The query is defined in the relevant dataset directory's `query.rq` file.
  //
  // @param dataset - the name of one of the configured datasets, or true to get all of them.
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  // The data should be an object with the properties:
  // - `data`: [Array] list of inititive definitions, each a map of field names to values
  // - `meta`: [Object] a map of the following information:
  //    - `endpoint`: [String] the SPARQL endpoint queried 
  //    - `query`: [String] the SPARQL query used
  //    - `default_graph_uri`: [String] the default graph URI for the query (which
  //       is expected to self-resolve to the dataset's index webpage)
  async fetchDataset(dataset: Dataset): Promise<SparqlDatasetResponse> {

    let service = `${getDatasetPhp}?dataset=${encodeURIComponent(dataset.id)}`;

    // Note, caching currently doesn't work correctly with multiple data sets
    // so until that's fixed, don't use it in that case.
    const numDatasets = this.config.namedDatasets().length;
    const noCache = numDatasets > 1 ? true : this.config.getNoLodCache();
    if (noCache) {
      service += "&noLodCache=true";
    }
    console.debug("fetchDataset", service);
    
    return await json(service);
  }
}
