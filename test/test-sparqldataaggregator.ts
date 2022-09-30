
import { expect } from 'chai';

import { SparqlDataAggregator } from '../www/map-app/app/model/sparqldataaggregator';
import { Config } from '../www/map-app/app/model/config';
import {
  PropDefs,
  Initiative,
  InitiativeObj,
  DataServices,
  basePropertySchema
} from '../www/map-app/app/model/dataservices';
import { VocabIndex, VocabServiceImpl } from '../www/map-app/app/model/vocabs';
import { Dictionary } from '../www/map-app/common_types';

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

// The Vocabs (just has a couple of kinds)
const vocabIndex: VocabIndex = {
  "prefixes": {
    "https://example.com/organisational-structure/": "os",
    "https://example.com/economic-activity/": "ea"
  },
  "meta": {
    "vocab_srcs": [
      {
        "endpoint": "http://example.com:8890/sparql",
        "defaultGraphUri": "https://dev.lod.coop/coops-uk",
        "uris": {
          "https://example.com/economic-activity/": "ea",
          "https://example.com/organisational-structure/": "os"
        }
      }
    ],
    "languages": [
      "EN"
    ],
    "queries": [
      "dummy query",
    ]
  },
  "vocabs": {
    "os:": {
      "EN": {
        "title": "OrgStruct",
        "terms": {
          "os:OS10": "Community group (formal or informal)",
          "os:OS100": "Multi-stakeholder cooperative",
          "os:OS110": "Secondary cooperative",
          "os:OS115": "Cooperative",
          "os:OS120": "Community Interest Company (CIC)",
          "os:OS130": "Community Benefit Society / Industrial and Provident Society (IPS)",
          "os:OS140": "Employee trust",
          "os:OS150": "Self-employed",
          "os:OS160": "Unincorporated",
          "os:OS170": "Mutual",
          "os:OS180": "National apex",
          "os:OS190": "National sectoral federation or union",
          "os:OS20": "Not-for-profit organisation",
          "os:OS200": "Regional, state or provincial level federation or union",
          "os:OS210": "Cooperative group",
          "os:OS220": "Government agency/body",
          "os:OS230": "Supranational",
          "os:OS240": "Cooperative of cooperatives / mutuals",
          "os:OS30": "Social enterprise",
          "os:OS40": "Charity",
          "os:OS50": "Company (Other)",
          "os:OS60": "Workers cooperative",
          "os:OS70": "Housing cooperative",
          "os:OS80": "Consumer/User coops",
          "os:OS90": "Producer cooperative"
        }
      },
    },
    "ea:": {
      "EN": {
        "title": "EcAc",
        "terms": {
          "ec:EC10": "Agriculture",
          "ec:EC100": "Mining",
          "ec:EC110": "Professional",
          "ec:EC120": "Service",
          "ec:EC130": "Tourism",
          "ec:EC140": "Financial Services",
          "ec:EC150": "Insurance",
          "ec:EC160": "Education",
          "ec:EC170": "Health",
          "ec:EC180": "Community",
          "ec:EC190": "Social",
          "ec:EC20": "Dairy",
          "ec:EC200": "Social Service",
          "ec:EC210": "Housing",
          "ec:EC220": "Transport",
          "ec:EC230": "Utilities",
          "ec:EC240": "Retail",
          "ec:EC250": "Production",
          "ec:EC260": "Wholesale and retail trade",
          "ec:EC270": "Education / health / social work",
          "ec:EC280": "Other Services",
          "ec:EC290": "All (Services)",
          "ec:EC30": "Forestry",
          "ec:EC40": "Irrigation",
          "ec:EC50": "Fishing",
          "ec:EC60": "Artisans",
          "ec:EC70": "Construction",
          "ec:EC80": "Industry",
          "ec:EC90": "Manufacturing"
         }
      },
    },
  }
};
// A vocab service
const vocabs = new VocabServiceImpl(vocabIndex, 'EN');

// The property schema for the data
const propertySchema: PropDefs = {
  ... basePropertySchema, // common fields
  primaryActivity: {
    type: 'vocab',
    uri: 'ea:',
  },
  secondaryActivities: {
    type: 'multi',
    of: {
      type: 'vocab',
      uri: 'ea:',
    },
  },
  orgStructure: {
    type: 'vocab',
    uri: 'os:',
    from: 'regorg',
  },
};

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
function aggregate(data: InitiativeObj[]) {
  const dataAggregator = new SparqlDataAggregator(config, propertySchema, vocabs, labels);
  dataAggregator.addBatch(data);
  dataAggregator.complete();
  return dataAggregator;
}

// Function which aggregates, then returns stripped registeredValues
function registeredValues(data: InitiativeObj[]) {
  return stripInitiatives1(aggregate(data).registeredValues);
}


// Finally, the tests
describe('SparqlDataAggregator', () => {
  
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
          'OrgStruct': { 'os:OS10': [ 'A' ]},
        });
    });
    
    it('with two items', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', 'OS10'),
      ]))
        .to.deep.equal({
          'OrgStruct': { 'os:OS10': [ 'A', 'B' ]},
        });
    });
    
    it('with items out of order', () => {      
      // Aggregaged order should be sorted, and not depend on item order
      expect(registeredValues([
        mkInitiativeObj('B', 'OS10'),
        mkInitiativeObj('A', 'OS10'),
      ]))
        .to.deep.equal({
          'OrgStruct': { 'os:OS10': [ 'A', 'B' ]},
        });
          });
    
    it('with two vocabs', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', undefined, 'EA10'),
      ]))
        .to.deep.equal({
          'OrgStruct': { 'os:OS10': [ 'A' ]},
          'EcAc': { 'ea:EA10': [ 'B' ]},
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
          'OrgStruct': { 'os:OS10': [ 'A', 'E' ], 'os:OS20': [ 'D' ]},
          'EcAc': { 'ea:EA10': [ 'B', 'E' ], 'ea:EA20': [ 'D' ]},
        });
    });

    it('with invalid vocabs terms', () => {
      expect(registeredValues([
        mkInitiativeObj('A', 'OS10'),
        mkInitiativeObj('B', undefined, 'OS10'), // Base Membership has no OS10 value
      ]))
        .to.deep.equal({
          'OrgStruct': { 'os:OS10': [ 'A' ]},
          'EcAc': { 'ea:OS10': [ 'B' ]}, // Oops, this probably shouldn't happen
        });
    });
  });
});

