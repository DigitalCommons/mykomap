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

  it('getTerms() - no initiatives', () => {
    const terms = vocabServices.getTerms(
      'EN', {}, propertySchema
    );
    //console.log(JSON.stringify(terms, null, 2));
    expect(terms).to.deep.equal({});

  });


  it('getTerms() - some initiatives', () => {
    console.log(initiativeIndex);
    const terms = vocabServices.getTerms(
      'EN', initiativeIndex, propertySchema
    );
    console.log(JSON.stringify(terms, null, 2));
    expect(terms).to.deep.equal(
      {
        "Letters": {
          "l:f": "F",
          "l:b": "B"
        },
        "Vowels": {
          "v:o": "O",
          "v:a": "A"
        }
      }
    );

  });
});
