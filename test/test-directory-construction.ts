import { expect } from 'chai';
import {
  vocabIndex1 as vocabIndex,
  initiativeIndexFooBarBazBob as items,
  lettersPropDefs as propDefs,
} from './data';
import {
  Dictionary
} from '../src/map-app/common-types';

import {
  PropertyIndexer
} from '../src/map-app/app/model/property-indexer';

import { Initiative } from '../src/map-app/app/model/initiative';
import { Vocab } from '../src/map-app/app/model/vocabs';
import { PropDefIndex } from '../src/map-app/app/model/prop-def-index';

const vocabMap = vocabIndex.vocabs;

// Mappings for non-vocab property titles. The keys need to be
// 'property_' suffixed with the property ID.  Can remain empty if
// we don't care about naming non-vocab values
const labels: Dictionary = {
  // However, we'll test giving the letters field a title 'Letters'
  property_name: 'Name',
}

// This function maps vocab IDs to the displayable term
function getVocab(id: string): Vocab {
  const ent = Object.entries(vocabIndex.prefixes).find(e => e[1] === id);
  const uri = ent? ent[0] : id;
  const vocab = vocabMap[uri].EN;
  if (!vocab) throw new Error(`no vocab for URI ${uri}`);
  return vocab;
}


// Finally, the tests
describe('Directory generation', () => {

  // These are the indexes to build
  const titleValInitiative: Dictionary<Dictionary<Initiative[]>> = {};

  // These are the names of the properties we want to index
  const propNames: string[] = ['name', 'initial', 'letters', 'vowels'];

  const propDefIndex: PropDefIndex = new PropDefIndex(propDefs, getVocab, labels);

  console.log(items);
  
  const propIndexer = new PropertyIndexer(
    titleValInitiative,
    propNames,
    propDefIndex,
    getVocab
  );

  it('transforms this object', () => { // Somewhat random test case
    Object.values(items).forEach(initiative => initiative && propIndexer.onData(initiative));
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

  });
});


/* TODO:
   - allow alternative vocab titles ((so if the vocab is http://vocab.com/letters/, 
     we could display the vocab as "Initial" instead of "Letters")

   - allow two properties to use the same vocab, using different
     titles (so if the vocab is http://vocab.com/letters/, one is, say
     "First Letter" and the other is "Letters")
*/


