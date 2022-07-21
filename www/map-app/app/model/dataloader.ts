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
export interface DataConsumer {
  // Add a batch of data. May be called multiple times.
  addBatch(initiatives: InitiativeObj[]): void;

  // Finishes the load after all data has been seen.
  complete(): void;
}

// For loading Datsets using a DataConsumer
export interface DataLoader {
  // Asynchronously load the datasets given, feeding it to the consumer given.
  // @returns a promise indicating when this has been done.
  loadDatasets(datasets: Dataset[], consumer: DataConsumer): Promise<void>;
}

// For aggregating Vocab and InitiativeObj data into a form used by DataServices
//
// This is a DataConsumer which builds up the required datastructures.
export interface DataAggregator extends DataConsumer {
  initiativesByUid: Dictionary<Initiative>;
  loadedInitiatives: Initiative[];
  registeredValues: Dictionary<Dictionary<Initiative[]>>;
  allRegisteredValues: Dictionary<Initiative[]>;

  // Filtered fields of type vocab, indexed by vocab prefix
  vocabFilteredFields: Dictionary;
}

