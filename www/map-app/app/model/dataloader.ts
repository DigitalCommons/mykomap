import type {
  Dictionary
} from '../../common_types';

import type {
  Initiative,
  InitiativeObj,
} from './dataservices';

import {
  sortInitiatives,
} from './dataservices';

// Defines properties of a dataset which can be loaded.
export interface DatasetMeta {
  id: string;
  name: string;
}

// For loading InitiativeObj data incrementally
//
// A variety of the visitor pattern. The details of what is done by the
// consumer is abstracted, and so up to the implementation.
export interface DataConsumer {
  // Add a batch of data. May be called multiple times.
  addBatch(initiatives: InitiativeObj[]): void;

  // Finishes the load after all data has been seen.
  complete(): void;
}

export class AggregatedData {
  
  // An index of URIs to the initiative with that URI
  readonly initiativesByUid: Dictionary<Initiative> = {};

  // An index of property titles to property values to lists of initiatives with that property value 
  readonly registeredValues: Dictionary<Dictionary<Initiative[]>> = {};

  /// An index of property titles to lists of Initiatives with that property
  readonly allRegisteredValues: Dictionary<Initiative[]> = {};
  
  /// An list of all initiatives
  readonly loadedInitiatives: Initiative[] = [];

  // An index of vocab URIs (of those filterableFields which are vocabs) to the referencing property ID (from the filterableFields)
  // FIXME is this not going to be losing information when filterableFields have two items with the same vocab?
  readonly vocabFilteredFields: Dictionary = {};
  
  // Searches loadedInitiatives for objects whose searchstr fields include the search text
  //
  // @return a list sorted by the name field.
  search(text: string): Initiative[] {
    // returns an array of sse objects whose name contains the search text
    var up = text.toUpperCase();
    return this.loadedInitiatives.filter(
      (i: Initiative) => i.searchstr.includes(up)
    ).sort((a: Initiative, b: Initiative) => sortInitiatives(a, b));
  }  
}

// For loading Datsets using a DataConsumer
//
// This is explicitly intended to construct an instance of AggregatedData,
// which is returned via the promise.
export interface DataLoader {
  // Asynchronously load the datasets given, using the dataConsumer .
  //
  // @param [string[]] datasetIds - an array of dataset IDs
  // @param [T] dataConsumer - a DataConsumer object to feed the data to incrementally.
  // @param onDataset - a callback to invoke when each dataset loads (or fails)
  //
  // Individual datasets' success or failure is signalled via
  // onDataset.
  //
  // @returns a promise containing the dataConsumer which resolves when all
  // datasets are fully loaded and processed by the consumer
  //
  // @throws [Error] when an unrecoverable error occurs, which may or
  // may not be associated with a dataset. Errors which are
  // recoverable are indicated by calling the onData callback.
  loadDatasets<T extends DataConsumer>(datasetIds: string[], dataConsumer: T,
                                       onDataset?: (id: string, error?: Error) => void): Promise<T>;
}
