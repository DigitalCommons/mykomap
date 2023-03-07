import type {
  Dictionary,
} from '../../common-types';

import {
  DataLoader,
  DataConsumer,
  DataLoaderError,
} from './dataloader';

import {
  VocabIndex,
  SparqlVocabMeta,
  isSparqlVocabResponse,
} from './vocabs';

import { json } from 'd3';
import { HostSparqlVocabParams } from './config_schema';

// For loading Vocabs using a DataConsumer
//
export class SparqlVocabLoader implements DataLoader<VocabIndex> {
  meta?: SparqlVocabMeta;
  
  constructor(readonly id: string,
              readonly serviceUrl: string,
              readonly languages: string[],
              readonly vocabularies: HostSparqlVocabParams[]) {}
  
  // Asynchronously load the vocab given, passing it to the dataConsumer.
  //
  // @param [T] dataConsumer - a DataConsumer object to feed the data
  // to incrementally.
  //
  // Individual datasets' success is signalled by callng
  // dataConsumer.complete(), and failure is signalled via
  // dataConsumer.fail()
  //
  // @returns a promise containing the dataConsumer which resolves
  // when all data are fully loaded and processed by the consumer
  //
  // @throws [Error] when an error occurs, which will be a
  // DataLoaderError when associated with a dataset.
  async load(dataConsumer: DataConsumer<VocabIndex>): Promise<this> {
    const result = await json(this.serviceUrl, {
      method: 'POST',
      body: JSON.stringify({
        languages: this.languages,
        vocabularies: this.vocabularies,
      }),
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    });
    
    if (isSparqlVocabResponse(result)) {
      const vocabIndex: VocabIndex = {
        prefixes: result.prefixes,
        vocabs: result.vocabs,
      };

      this.meta = result.meta;

      dataConsumer.addBatch(this.id, [vocabIndex]);
      dataConsumer.complete(this.id);
      return this;
    }
    
    throw new DataLoaderError(`Invalid JSON result returned by hostSparql proxy`, this);
  }
}
