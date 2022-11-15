import { use, expect, assert } from 'chai';

import {
  ObjTransform,
  Transforms as t,
  mkObjTransformer,
} from '../src/map-app/obj-transformer'

import {
  Dictionary
} from '../src/map-app/common_types';

interface Period {
  start: Date|null;
  end: Date;
  degree: number|null;
  age: number;
  list1: number[];
  list2: (number|null)[];
  list3: (string|null)[];
  something: string|null;
  symbol: 'apple'|'banana'|'carrot';
}


// Finally, the tests
describe('ObjTransform', () => {

  const mapping: ObjTransform<Dictionary, Period> = {
    // start: { from: 'a', transform: (a: string|null|undefined): Date => a? new Date(a) : new Date() },
    start: t.nullable.date().from('a'),
    end: t.date().from('b'),
    degree: t.nullable.number().from('c'),
    age: t.number().from('d'),
    list1: t.multi({of: t.number(), delim: '-'}).from('a'),
    list2: t.multi({of: t.nullable.number(-1), delim: '2'}).from('a'),
    list3: t.multi({of: t.nullable.text(), delim: ' '}).from('e'),
    symbol: t.symbol(['apple','banana','carrot'] as const, 'carrot').from('g'),
    something: t.nullable.text(null).from('f'),
  };

  const transformer = mkObjTransformer(mapping);

  it('transforms this object', () => { // Somewhat random test case
    const orig: Dictionary<string>  = {
      a: '2022-01-23', b: '2022-02-06', c: '3', d: '4', e: "The 'fox\\'s' quick  jump over the lazy\\ dogs", f: undefined, g: 'applez',
    }
    const result = transformer(orig);
    console.log(result);
    expect(result).to.deep.equal(
      {
        start: new Date('2022-01-23T00:00:00.000Z'),
        end: new Date('2022-02-06T00:00:00.000Z'),
        degree: 3,
        age: 4,
        list1: [ 2022, 1, 23 ],
        list2: [ -1, 0, -1, -1, 3 ],
        list3: [
          'The',
          "'fox's'",
          'quick',
          '',
          'jump',
          'over',
          'the',
          'lazy dogs'
        ],
        something: null,
        symbol: 'carrot',
      }
    );
  });
});

describe('ValTransforms', () => {

  // FIXME add tests for other transforms
  
  describe('NullableNumberTransform', () => {

    it('default null', () => {
      const tr = t.nullable.number(null);

      expect(tr.transform(''))
        .to.equal(null);
      expect(tr.transform(' '))
        .to.equal(null);
      expect(tr.transform('.'))
        .to.equal(null);
      expect(tr.transform('0'))
        .to.equal(0);
      expect(tr.transform(' 0 '))
        .to.equal(0);
      expect(tr.transform(' 0. '))
        .to.equal(0);
      expect(tr.transform(' .0 '))
        .to.equal(0);
      expect(tr.transform(' 0.0 '))
        .to.equal(0);

      expect(tr.transform(' -0 '))
        .to.equal(0);
      expect(tr.transform(' -1 '))
        .to.equal(-1);
      expect(tr.transform(' 1 '))
        .to.equal(1);
      expect(tr.transform(' o '))
        .to.equal(null);
      
      expect(tr.transform(' 0o '))
        .to.equal(null);
      
      expect(tr.transform(' 0e0 '))
        .to.equal(0);
      expect(tr.transform(' 1e2 '))
        .to.equal(100);
      expect(tr.transform(' 1e-2 '))
        .to.equal(0.01);
    });
  });

  describe('StrictMultiTransform', () => {

    it('of: text, with default params', () => {
      const tr = t.multi({of: t.text()});

      expect(tr.transform(''))
        .to.deep.equal(['']);
      
      expect(tr.transform(';'))
        .to.deep.equal(['', '']);
      
      expect(tr.transform('foo;bar;baz'))
        .to.deep.equal(['foo','bar','baz']);
      
      expect(tr.transform('foo;;baz'))
        .to.deep.equal(['foo','','baz']);
      
      expect(tr.transform('foo;\\;baz'))
        .to.deep.equal(['foo',';baz']);
      
      expect(tr.transform('foo;\\bar\\;baz'))
        .to.deep.equal(['foo','bar;baz']);
      
    });

    it('of: text, omitting blanks, single value', () => {
      const tr = t.multi({of: t.text(), omit: ''});

      expect(tr.transform(''))
        .to.deep.equal([]);
      
      expect(tr.transform(';'))
        .to.deep.equal([]);
      
      expect(tr.transform('foo;bar;baz'))
        .to.deep.equal(['foo','bar','baz']);
      
      expect(tr.transform('foo;;baz'))
        .to.deep.equal(['foo','baz']);
      
      expect(tr.transform('foo; ;baz'))
        .to.deep.equal(['foo',' ', 'baz']);
    });

    it('of: text, omitting blanks and space, double value', () => {
      const tr = t.multi({of: t.text(), omit: ['', ' ']});

      expect(tr.transform(''))
        .to.deep.equal([]);
      
      expect(tr.transform(';'))
        .to.deep.equal([]);
      
      expect(tr.transform('foo;bar;baz'))
        .to.deep.equal(['foo','bar','baz']);
      
      expect(tr.transform('foo;;baz'))
        .to.deep.equal(['foo','baz']);
      
      expect(tr.transform('foo; ;baz'))
        .to.deep.equal(['foo','baz']);
    });
  });
});

