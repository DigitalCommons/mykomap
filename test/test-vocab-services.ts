import { expect } from 'chai';

import {
  VocabServiceImpl,
  VocabServices
} from '../src/map-app/app/model/vocabs';

import {
  vocabIndex1 as vocabIndex,
  lettersPropDefs as propertySchema,
  initiativeIndexFooBarBazBob as initiativeIndex,
} from './data';


// Finally, the tests
describe('VocabServices', () => {

  const vocabServices: VocabServices = new VocabServiceImpl(vocabIndex, 'EN')


  // FIXME add more tests!
});
