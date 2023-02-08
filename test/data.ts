import { basePropertySchema, Initiative, InitiativeObj, PropDef, PropDefs } from "../src/map-app/app/model/dataservices";
import { SparqlVocabResponse, VocabIndex } from "../src/map-app/app/model/vocabs";
import { Dictionary } from "../src/map-app/common_types";


export const vocabIndex1: VocabIndex = {  
  prefixes: {
    'http://vocab.com/vowels/': 'v',
    'http://vocab.com/letters/': 'l',
  },
  vocabs: {    
    'http://vocab.com/vowels/': {
      EN: {
        title: 'Vowels',
        terms: {
          'v:a': 'A',
          'v:e': 'E',
          'v:i': 'I',
          'v:o': 'O',
          'v:u': 'U',
        },
      },
    },
    'http://vocab.com/letters/': {
      EN: {
        title: 'Letters',
        terms: {
          'l:f': 'F',
          'l:o': 'O',
          'l:b': 'B',
          'l:a': 'A',
          'l:r': 'R',
          'l:z': 'Z',
        },
      },/*
        // Basically could be Letters, but we can't currently
        // share vocabs between the properties letters and initial
        'http://vocab.com/initials/': {
        EN: {
        title: 'Initials',
        terms: {
        'i:f': 'F',
        'i:b': 'B',
        },
        },*/
    }
  }
};

// These are the definitions of the properties
export const lettersPropDefs: PropDefs = {
  ... basePropertySchema, // common fields

  name: { type: 'value' },
  initial: { type: 'vocab', uri: 'http://vocab.com/letters/' },
  letters: { type: 'multi', of: { type: 'value' } },
  vowels: { type: 'multi', of: { type: 'vocab', uri: 'http://vocab.com/vowels/' } },
};

// About the simplest paramBuilder possible - just looks up the parameter.
function superSimpleParamBuilder(id: string, defs: PropDef, params: InitiativeObj): any {
  return params[id];
}


// This is an initiative constructor, which uses the above propDefs
// and paramBuilder
export const lettersMkInitiative = Initiative.mkFactory(lettersPropDefs, superSimpleParamBuilder, []);

// Construct some initiatives. Use some simple rules to set a
// representative collection of fields types from a string
// identifier - the first letter of the name
export const initiativeIndexFooBarBazBob: Dictionary<Initiative> = Object.fromEntries(
  [
    'foo', 'bar', 'baz', 'bob' // The names
  ]
    .map(name => [name, lettersMkInitiative({
      uri: 'init:'+name, // The abbreviated URI for this initiative
      name: name,        // The name, unchanged - a simple value
      initial: 'l:'+name[0].toLocaleLowerCase(), // The initial - an abbreviated vocab URI.
      letters: name.split('') // The letters in the name, an array of simple values
        .map(c => c.toLocaleLowerCase()), 
      vowels: name.split('') // The vowels in the name - an array of
      // unabbreviated vocab URIs. May contain duplicates!
        .map(c => c.toLocaleLowerCase())
        .filter(c => c.match(/[aeiou]/))
        .map(v =>'http://vocab.com/vowels/'+v),
    })])
);
