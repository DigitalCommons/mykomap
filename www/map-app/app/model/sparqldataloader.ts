import {
  Dataset,
  DataLoader,
  DataConsumer,
  AggregatedData,
} from './dataloader';

import {
  InitiativeObj,
} from './dataservices';

import {
  Config,
} from './config';

import { json } from 'd3';

interface SparqlDatasetResponse {
  meta: {
    endpoint?: string;
    default_graph_uri?: string;
    query?: string;
  };
  data: InitiativeObj[];
  status?: "success";
}

function isSparqlDatasetResponse(value: any): value is SparqlDatasetResponse {
  if (typeof value === 'object')
    return true; // FIXME this is a hack until we have more heavyweight type validation tools
  return false;
}

export class SparqlDataLoader implements DataLoader {
  private readonly maxInitiativesToLoadPerFrame = 100;
  private readonly useCache: boolean;
  private readonly serviceUrl: string;

  constructor(serviceUrl: string, useCache: boolean = false) {
    this.serviceUrl = serviceUrl;
    this.useCache = useCache;
  }
    
  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param [String] dataset - the identifier of this dataset
  // @param [T] dataConsumer - a DataConsumer object to feed the data to incrementally.
  // @param onDataset - a callback to invoke when each dataset loads (or fails)
  //
  // @returns a promise containing the dataConsumer which resolves when all
  // datasets are fully loaded and processed by the consumer
  async loadDatasets<T extends DataConsumer>(datasets: Dataset[], dataConsumer: T,
                                             onDataset?: (id: string, error?: Error) => void): Promise<T> {

    // Launch the dataset loaders asynchronously, obtaining an array of promises
    // for an [<id>, <data>] pair.
    // Make an index of datasetIds to expect to the relevant dataset loader promises
    let outstanding = Object.fromEntries(datasets.map(
      ds => [ds.id, this.loadDataset(ds)]
    ));

    // Process the data as it arrives, in chunks    
    while(Object.keys(outstanding).length > 0) {
      try {
        const outstandingPromises = Object.values(outstanding);

        let dataset: Dataset | undefined;
        let initiativeData: InitiativeObj[] | undefined;
        try {
          // Should always succeed, possibly with an error obect instead of the data.
          // Failures in the promise machinery may cause it to throw.
          const result = await Promise.any(outstandingPromises);
          dataset = result.dataset;
          
          if (result.data instanceof Error)
            throw result.data; // Normal failure

          // Normal success
          initiativeData = result.data;
        }
        catch(e) {
          // If this is not a normal failure, dataset will be undefined.
          console.error("loading dataset " + dataset?.id + " failed", e);

          const error =  e instanceof Error? e : new Error(String(e));
          onDataset?.(dataset?.id ?? '<unknown>', error);
          
          continue;
        }
        
        // A dataset has arrived (or failed)... check it off the list
        if (dataset.id)
          delete outstanding[dataset.id];

        // Skip failed datasets, which will be undefined
        if (dataset !== undefined && dataset.id !== undefined && initiativeData !== undefined) {
          
          // Load initiatives in chunks, to keep the UI responsive
          while(initiativeData.length > 0) {
            const batch: InitiativeObj[] = [];

            // We have to be aware that an initiative can be spread
            // across several records, due to the way that a SPARQL
            // response encodes fields with multiple values as
            // multiple records with the non-multiple fields
            // duplicated, and the multiple fields varying.
            //
            // Therefore, read in records with the same uri all at once
            while(batch.length < this.maxInitiativesToLoadPerFrame) {
              const item = this.readInitiativeObj(initiativeData);
              if (item === undefined) break; // stop if we run out of items

              batch.push(item);
            }
            
            // Call addInitiatives in the background, to prevent it blocking other processes.
            try {
              await (async () => dataConsumer.addBatch(batch))();
              onDataset?.(dataset.id);
            }
            catch(e) {
              // Abort this dataset.
              initiativeData.length = 0;
              
              console.error("Error whilst processing datasets: ", e);

              const error = e instanceof Error? e : new Error(String(e));
              onDataset?.(dataset.id, error);
            }
          }
        }
      }
      catch(error) {
        // All promises should have errors caught already. Therefore this
        // shouldn't normally occur, except possibly if there are no
        // datasets.  Ignore this.
        console.debug("Unexpected exception whilst processing datasets: ", error);
      }
    }

    // Having loaded all we can, finish off
    dataConsumer.complete();

    return dataConsumer;
  }

  // Amalgamates multiple records into the same InitiativeObj if they
  // have the same uri.
  //
  // Note that this has to work on local context, so it cannot spot
  // multiple records when there is only one, or when they are null. 
  // So this:
  //
  //     [{ uri: 'xxx', multivalue: 1 },
  //      { uri: 'xxx', multivalue: 2 },
  //      { uri: 'yyy', multivalue: undefined },
  //      { uri: 'zzz', multivalue: 4 }]
  //
  // Becomes this:
  //
  //     [{ uri: 'xxx', multivalue: [1,2] },
  //      { uri: 'yyy', multivalue: undefined },
  //      { uri: 'zzz', multivalue: 4 }]
  //
  // Note that yyy and zzz's multivalue fields are represented by a
  // single non-array value. This is due to the lack of any metadata
  // at the time of pre-processing. Note also that this applies to
  // nulls or undefineds, which need to be interpreted downstream as
  // empty lists, not a list of a single undefined.
  //
  // The SparqlDataAggregator then turns these objects into
  // Initiatives in one step. This makes it simpler to switch to a
  // source which is not coming from sparql (like a CSV).  It also
  // means, at a pinch, that this algorithm can still consume the old
  // data.
  //
  // The plan is to make the server send more sensibly formatted
  // multiple fields later.
  private readInitiativeObj(records: InitiativeObj[]): InitiativeObj | undefined {
    if (records.length === 0)
      return undefined; // No more records

    const first = records.shift(); // Read the first

    // Add any more with the same uri Note, we're a bit limited by
    // what we can infer without having access to the expected
    // property schema, or any metadata from SPARQL about the field
    // types.  If we get multiple identical values in a multivalue
    // field, we might not be able to tell it isn't single valued.
    // Live with this for now, later move this code to the
    // server-side, where this metadata is available.
    while(records.length > 0 && records[0].uri === first?.uri) {
      const next = records.shift();
      if (!next) continue;
      
      Object.entries(next)
        .forEach(entry => {
          const [key, val] = entry;

          if (val === first[key]) 
            return; // Infer this is not a multi-value property, do nothing.

          // Add this new value to the multi-valued property. Also ensures the above check will
          // continue for all subsequent values.
          if (typeof first[key] === 'object' && first[key] instanceof Array) {
             // Add the value to an existing array
            first[key].push(val);
          }
          else {
            // This is the first value, create the array, retaining this and the previous value
            first[key] = [first[key], val];
          }
        });
    }

    // Done
    return first;
  }

  // Calls this.loadDataset and populates the dataset object.
  //
  // Shouldn't ever throw even on failure - the caller relies on
  // getting the dataset id to report the failure. Although if the
  // dataset.id field is not set of course this isn't possible.
  //
  // @returns If successful returns an object containing a copy of the
  // dataset passed but with missing fields populated, and the
  // data. On failure returns an object with the original dataset, and
  // an error object.
  async loadDataset(dataset: Dataset): Promise<{dataset: Dataset, data: InitiativeObj[] | Error}> {
    try {
      const response: SparqlDatasetResponse = await this.fetchDataset(dataset);
      console.debug("loaded " + dataset.id + " data", response);

      return { dataset: {id: dataset.id,
                         name: dataset.name,
                         endpoint: response.meta.endpoint ?? '',
                         dgu: response.meta.default_graph_uri ?? '',
                         query: response.meta.query ?? ''},
               data: [...response.data] };
    }
    catch(e) {
      const error = e instanceof Error? e : new Error(String(e));
      return { dataset: dataset, data: error};
    }    
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

    let service = `${this.serviceUrl}?dataset=${encodeURIComponent(dataset.id)}`;

    if (!this.useCache) {
      service += "&noLodCache=true";
    }
    console.debug("fetchDataset", service);
    
    const result = await json(service);
    if (isSparqlDatasetResponse(result))
      return result;

    throw new Error(`Invalid response from endpoint '${this.serviceUrl}' is not a SparqlDatasetResponse`);
  }
}
