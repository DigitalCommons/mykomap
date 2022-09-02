import type {
  Dictionary
} from '../../common_types';

import type {
  Initiative,
  InitiativeObj,
} from './dataservices';

// Defines properties of a dataset which can be loaded.
export interface Dataset {
  id: string;
  name: string;
  endpoint: string;
  dgu: string;
  query: string;
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

export interface AggregatedData {
  initiativesByUid: Dictionary<Initiative>;
  loadedInitiatives: Initiative[];
  registeredValues: Dictionary<Dictionary<Initiative[]>>;
  allRegisteredValues: Dictionary<Initiative[]>;

  // Filtered fields of type vocab, indexed by vocab prefix
  vocabFilteredFields: Dictionary;
}

// For loading Datsets using a DataConsumer
//
// This is explicitly intended to construct an instance of AggregatedData,
// which is returned via the promise.
export interface DataLoader {
  // Asynchronously load the datasets given, 
  // @returns the AggregatedData via a promise
  loadDatasets(datasets: Dataset[]): Promise<AggregatedData>;
}
