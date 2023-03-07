import {
  DataLoader,
  DataConsumer,
  DataLoaderError,
} from './data-loader';

import {
  VocabIndex,
  isVocabIndex,
} from './vocabs';

import { json } from 'd3';

// For loading Vocabs from a suitably constructed JSON file
//
export class JsonVocabLoader implements DataLoader<VocabIndex> {
  
  constructor(readonly id: string,
              readonly url: string) {}
  
  async load(dataConsumer: DataConsumer<VocabIndex>): Promise<this> {
    const result = await json(this.url);
    
    if (isVocabIndex(result)) {
      dataConsumer.addBatch(this.id, [result]);
      dataConsumer.complete(this.id);
      return this;
    }
    
    throw new DataLoaderError(`Invalid JSON result, not of type VocabIndex, returned by URL '${this.url}'`, this);
  }
}
