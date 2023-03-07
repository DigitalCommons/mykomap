import { basePropertySchema, PropDef, PropDefs } from "../src/map-app/app/model/data-services";
import { Initiative, InitiativeObj } from "../src/map-app/app/model/initiative";
import { SparqlVocabResponse, VocabIndex } from "../src/map-app/app/model/vocabs";
import { Dictionary } from "../src/map-app/common-types";

// The Vocabs (just has a couple of kinds)
export const sparqlVocabResponse1: SparqlVocabResponse = {
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

// A simple property schema
export const propertySchema1: PropDefs = {
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
