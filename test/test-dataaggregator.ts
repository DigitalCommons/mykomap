
import { expect } from 'chai';

import { DataAggregator } from '../src/map-app/app/model/data-aggregator';
import { Config } from '../src/map-app/app/model/config';
import {
  Initiative,
  InitiativeObj,
} from '../src/map-app/app/model/initiative';
import { VocabServiceImpl } from '../src/map-app/app/model/vocabs';
import { Dictionary } from '../src/map-app/common-types';
import {
  sparqlVocabResponse1 as vocabIndex,
  propertySchema1 as propertySchema
} from './data';

// Makes a dummy InitiativeObj
function mkInitiativeObj(name: string, regorg?: string, ea?: string, sa?: string[]): InitiativeObj {
  const ini: InitiativeObj = {
    "name": name,
    "uri": "https://dev.lod.coop/nonesuch/"+name,
    "lat": "53.488061",
    "lng": "-2.237449",
    "dataset": "nonesuch"
  };
  if (regorg) 
    ini.regorg = "https://example.com/organisational-structure/"+regorg;
  if (ea)
    ini.primaryActivity = "https://example.com/economic-activity/"+ea;

  // Note that this is an *array* of values, as this field allows multiple values.
  if (sa)
    ini.secondaryActivities = sa.map(a => "https://example.com/economic-activity/"+a);
  
  return ini;
}


// The minimal config (just sets what to aggregate)
const config = new Config({
  filterableFields: ['orgStructure', 'primaryActivity'],
});

// A vocab service
const vocabs = new VocabServiceImpl(vocabIndex, 'EN');

// A set of dummy localisation labels to keep the aggregator happy
const labels = {};

// The aggregated data is heavily nested and difficult to read when
// populated with initatives.  These functions strip the initiatives
// down to just the name, for convenient comparisons.

function isDefinedVal<T>(item: [string, T | undefined]): item is [string, T] {
  return item !== undefined;
}

function mapValues<I, J>(data: Dictionary<I>, fn: (d: I | undefined) => J[]) {
  const entries = Object.entries(data);
  return entries.map(e => [e[0], fn(e[1])]);
}

function initiatives2Strings(items?: Initiative[]) {
  if (items)
    return items.map(item => item.name as String);
  else
    return [];
}

function stripInitiatives2(items?: Dictionary<Initiative[]>) {
  if (items)
    return Object.fromEntries(mapValues(items, initiatives2Strings));
  else
    return {};
}

function stripInitiatives1(items: Dictionary<Dictionary<Initiative[]>>) {
  return Object.fromEntries(mapValues(items, stripInitiatives2));
}


// Function which does the aggregation of data:
function aggregate(id: string, data: InitiativeObj[]) {
  const dataAggregator = new DataAggregator(config, propertySchema, vocabs, labels);
  dataAggregator.addBatch(id, data);
  dataAggregator.complete(id);
  return dataAggregator;
}

// Function which aggregates, then returns stripped registeredValues
function registeredValues(data: InitiativeObj[]) {
  return stripInitiatives1(aggregate('testDataset', data).registeredValues);
}


// Finally, the tests
describe('DataAggregator', () => {
  
  describe('should generate the correct registeredValues', () => {

    it('with no values', () => {
      expect(registeredValues([]))
        .to.deep.equal({
        });
    });
    
    it('with one value', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10')
      ]))
        .to.deep.equal({
          'orgStructure': { 'os:OS10': [ 'A' ]},
        });
    });
    
    it('with two items', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', 'OS10'),
      ]))
        .to.deep.equal({
          'orgStructure': { 'os:OS10': [ 'A', 'B' ]},
        });
    });
    
    it('with items out of order', () => {      
      // Aggregaged order should be sorted, and not depend on item order
      expect(registeredValues([
        mkInitiativeObj('B', 'OS10'),
        mkInitiativeObj('A', 'OS10'),
      ]))
        .to.deep.equal({
          'orgStructure': { 'os:OS10': [ 'A', 'B' ]},
        });
          });
    
    it('with two vocabs', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', undefined, 'EA10'),
      ]))
        .to.deep.equal({
          'orgStructure': { 'os:OS10': [ 'A' ]},
          'primaryActivity': { 'ea:EA10': [ 'B' ]},
        });
    });
    
    it('with many values in two vocabs', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', undefined, 'EA10'),
        mkInitiativeObj('C'),
        mkInitiativeObj('D', 'OS20', 'EA20'),
        mkInitiativeObj('E', 'OS10', 'EA10'),        
      ]))
        .to.deep.equal({
          'orgStructure': { 'os:OS10': [ 'A', 'E' ], 'os:OS20': [ 'D' ]},
          'primaryActivity': { 'ea:EA10': [ 'B', 'E' ], 'ea:EA20': [ 'D' ]},
        });
    });

    it('with invalid vocabs terms', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', undefined, 'OS10'), // Base Membership has no OS10 value
      ]))
        .to.deep.equal({
          'orgStructure': { 'os:OS10': [ 'A' ]},
          'primaryActivity': { 'ea:OS10': [ 'B' ]}, // Oops, this probably shouldn't happen
        });
    });
  });
});

