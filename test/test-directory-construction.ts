import { use, expect, assert } from 'chai';

import {
  Dictionary
} from '../src/map-app/common_types';

import {
  PropertyIndexer
} from '../src/map-app/app/model/propertyindexer';

import { Initiative, InitiativeObj, PropDef, PropDefs } from '../src/map-app/app/model/dataservices';
import { Vocab } from '../src/map-app/app/model/vocabs';
import { PropDefIndex } from '../src/map-app/app/model/propdefindex';

const vocabMap: Dictionary<Vocab> = {
  'http://vocab.com/vowels/': {
    title: 'Vowels',
    terms: {
      'v:a': 'A',
      'v:e': 'E',
      'v:i': 'I',
      'v:o': 'O',
      'v:u': 'U',
    },
  },
  'http://vocab.com/letters/': {
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
    title: 'Initials',
    terms: {
      'i:f': 'F',
      'i:b': 'B',
    },
  },*/
}

// Vocab abbreviations
const abbrevs: Dictionary = {
  v: 'http://vocab.com/vowels/',
  l: 'http://vocab.com/letters/',
}

// Mappings for non-vocab property titles. The keys need to be
// 'property_' suffixed with the property ID.  Can remain empty if
// we don't care about naming non-vocab values
const labels: Dictionary = {
  // However, we'll test giving the letters field a title 'Letters'
  property_name: 'Name',
}

// This function maps vocab IDs to the displayable term
function getVocab(id: string): Vocab {
  const uri = abbrevs[id] ?? id; // expand the id if it is a known URI
  const vocab = vocabMap[uri]
  if (!vocab) throw new Error(`no vocab for URI ${uri}`);
  return vocab;
}


// About the simplest paramBuilder possible - just looks up the parameter.
function paramBuilder(id: string, defs: PropDef, params: InitiativeObj): any {
  return params[id];
}

// Finally, the tests
describe('Directory generation', () => {

  // These are the indexes to build
  const titleValInitiative: Dictionary<Dictionary<Initiative[]>> = {};
  const idVocab: Dictionary = {};

  // These are the names of the properties we want to index
  const propNames: string[] = ['name', 'initial', 'letters', 'vowels'];

  // These are the definitions of the properties
  const propDefs: PropDefs = {
    name: { type: 'value' },
    initial: { type: 'vocab', uri: 'http://vocab.com/letters/' },
    letters: { type: 'multi', of: { type: 'value' } },
    vowels: { type: 'multi', of: { type: 'vocab', uri: 'http://vocab.com/vowels/' } },
  };
  const propDefIndex: PropDefIndex = new PropDefIndex(propDefs, getVocab, labels);

  // This is an initiative constructor, which uses the above propDefs
  // and paramBuilder
  const mkInitiative = Initiative.mkFactory(propDefs, paramBuilder, []);

  // Construct some initiatives. Use some simple rules to set a
  // representative collection of fields types from a string
  // identifier - the first letter of the name
  const items = Object.fromEntries(
    [
      'foo', 'bar', 'baz', 'bob' // The names
    ]
      .map(name => [name, mkInitiative({
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
  console.log(items);
  
  const propIndexer = new PropertyIndexer(
    titleValInitiative,
    idVocab,
    propNames,
    propDefIndex,
    getVocab
  );

  it('transforms this object', () => { // Somewhat random test case
    Object.values(items).forEach(initiative => propIndexer.onData(initiative));
    propIndexer.onComplete();
    console.log(JSON.stringify(propIndexer, null, 2));

    // First - byTitleThenValue. This should be a dictionary, keyed by
    // our chosen property titles, of dictonaries of initiative
    // arrays, keyed by the observed property values shared by those
    // initiatives. The arrays can have arbitrary order, but should
    // not contain duplicates. FIXME test this
    expect(propIndexer.byTitleThenValue)
      .to.be.an('object')
      .that.has.all.keys('Name', 'Vowels', 'letters', 'Letters'); 
    
    expect(propIndexer.byTitleThenValue.Name)
      .to.deep.equal({ // shortcut, since arrays are 1-element and can't be unsorted
        foo: [items.foo],
        bar: [items.bar],
        baz: [items.baz],
        bob: [items.bob],
      });
    
    expect(propIndexer.byTitleThenValue.letters)
      .to.be.an('object')
      .that.has.all.keys('f','o','b','a','r','z');
    expect(propIndexer.byTitleThenValue.letters?.f).to.have.all.members([items.foo])
    expect(propIndexer.byTitleThenValue.letters?.o).to.have.all.members([items.foo, items.bob])
    expect(propIndexer.byTitleThenValue.letters?.b).to.have.all.members([items.bar, items.baz, items.bob])
    expect(propIndexer.byTitleThenValue.letters?.a).to.have.all.members([items.bar, items.baz])
    expect(propIndexer.byTitleThenValue.letters?.r).to.have.all.members([items.bar])
    expect(propIndexer.byTitleThenValue.letters?.z).to.have.all.members([items.baz])

    expect(propIndexer.byTitleThenValue['Vowels'])
      .to.be.an('object')
      .that.has.all.keys('http://vocab.com/vowels/o','http://vocab.com/vowels/a');
    expect(propIndexer.byTitleThenValue['Vowels']?.['http://vocab.com/vowels/o'])
      .to.have.all.members([items.foo, items.bob]);
    expect(propIndexer.byTitleThenValue['Vowels']?.['http://vocab.com/vowels/a'])
      .to.have.all.members([items.bar, items.baz]);

    expect(propIndexer.byTitleThenValue['Letters'])
      .to.be.an('object')
      .that.has.all.keys('l:f','l:b');
    expect(propIndexer.byTitleThenValue['Letters']?.['l:f'])
      .to.have.all.members([items.foo]);
    expect(propIndexer.byTitleThenValue['Letters']?.['l:b'])
      .to.have.all.members([items.bar, items.baz, items.bob]);

    // Second - propIdByVocabUri. This should be a dictionary mapping
    // vocab URIs to properties which use it. FIXME This mechanism can't handle dupe vocabs!
    expect(propIndexer.propIdByVocabUri).to.deep.equal({
      'http://vocab.com/vowels/': 'vowels',
      'http://vocab.com/letters/': 'initial',
    })
  });
});


/* TODO:
   - allow alternative vocab titles ((so if the vocab is http://vocab.com/letters/, 
     we could display the vocab as "Initial" instead of "Letters")

   - allow two properties to use the same vocab (without mutual clobbering in propIdByVocabUri)

   - ditto, but use different titles (so if the vocab is http://vocab.com/letters/, one
     is, say "First Letter" and the other is "Letters")
*/


