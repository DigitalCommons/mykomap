import {
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

export interface SparqlMeta {
  endpoint?: string;
  default_graph_uri?: string;
  query?: string;
}

interface SparqlDatasetResponse {
  meta: SparqlMeta;
  data: InitiativeObj[];
  status?: "success";
}

function isSparqlDatasetResponse(value: any): value is SparqlDatasetResponse {
  if (typeof value === 'object')
    return true; // FIXME this is a hack until we have more heavyweight type validation tools
  return false;
}

export class SparqlDataLoader implements DataLoader<InitiativeObj> {
  private readonly maxInitiativesToLoadPerFrame = 100;
  private readonly useCache: boolean;
  private readonly serviceUrl: string;
  readonly id: string;
  meta?: SparqlMeta;
  
  constructor(id: string, serviceUrl: string, useCache: boolean = false) {
    this.serviceUrl = serviceUrl;
    this.useCache = useCache;
    this.id = id;
  }

  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param [T] dataConsumer - a DataConsumer object to feed the data
  // to incrementally, and ultimately signal success or failure.
  //
  // @returns a promise containing this DataConsumer which resolves
  // when all datasets are fully loaded and processed by the consumer,
  // or a failure has occurred.
  async load<T extends DataConsumer<InitiativeObj>>(dataConsumer: T): Promise<this> {
    
    const initiativeData: InitiativeObj[] = [];
    this.meta = undefined; // Ensure this is reset
    
    try {
      const response: SparqlDatasetResponse = await this.fetchDataset(this.id);
      console.debug(`loaded ${this.id} data`, response);
      
      this.meta = { // Fill in any missing fields in the JSON
        endpoint: response.meta?.endpoint ?? '',
        default_graph_uri: response?.meta?.default_graph_uri ?? '',
        query: response?.meta?.query ?? ''
      };

      // Copy the data so as not to alter the console log above
      initiativeData.push(...response.data);
      
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
        await (async () => dataConsumer.addBatch(this.id, batch))();
      }
    }
    catch(e) {
      // Abort this dataset.
      initiativeData.length = 0;
      
      console.error("loading dataset " + this.id + " failed:", e);

      // Ensure we have an error object
      const error =  e instanceof Error? e : new Error(String(e));
      dataConsumer.fail(this.id, error);
    }
    
    return this;
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
  // The DataAggregator then turns these objects into
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

  // Loads the initiatives data for the given dataset (or all of them) from the server.
  //
  // The query is defined in the relevant dataset directory's `query.rq` file.
  //
  // @param datasetId - the ID of one of the configured datasets
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  // The data should be a SparqlDatasetResponse object with the properties:
  // - `data`: [Array] list of inititive definitions, each a map of field names to values
  // - `meta`: [Object] a map of the following information:
  //    - `endpoint`: [String] the SPARQL endpoint queried 
  //    - `query`: [String] the SPARQL query used
  //    - `default_graph_uri`: [String] the default graph URI for the query (which
  //       is expected to self-resolve to the dataset's index webpage)
  async fetchDataset(datasetId: string): Promise<SparqlDatasetResponse> {

    let service = `${this.serviceUrl}?dataset=${encodeURIComponent(datasetId)}`;

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
