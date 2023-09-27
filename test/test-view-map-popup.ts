import { assert } from 'chai';
import { init as configBuilder } from '../src/map-app/app/model/config';
const config = configBuilder();

import { Dictionary } from '../src/map-app/common-types';
import { DataServicesImpl, PropDefs, basePropertySchema } from '../src/map-app/app/model/data-services';
import { VocabServiceImpl } from '../src/map-app/app/model/vocabs';
import { DataAggregator } from '../src/map-app/app/model/data-aggregator';

import { getPopup } from '../src/map-app/app/default-popup';
import { phraseBooks } from '../src/map-app/localisations';
const expectedContent = require('./expected/popups/default.json');

// The standard schema as it was when the test was created, translated
// into PropDefs
const fieldSchema: PropDefs = {
  ...basePropertySchema,
  desc: { type: 'value', as: 'string' },
  www: { type: 'value', as: 'string' },
  twitter: { type: 'value', as: 'string' },
  street: { type: 'value', as: 'string' },
  locality: { type: 'value', as: 'string' },    
  postcode: { type: 'value', as: 'string' },
  within: { type: 'value', as: 'string' },
  countryId: {
    type: 'vocab',
    uri: 'coun:',
  },
  regionId: {
    type: 'vocab',
    uri: 'reg:',
  },
  superRegionId: {
    type: 'vocab',
    uri: 'sreg:',
  },    
  primaryActivity: {
    type: 'vocab',
    uri: 'aci:',
  },
  activities: {
    type: 'multi',
    from: 'activity',
    of: {
      type: 'vocab',
      uri: 'aci:',
    },
  },
  regorg: {
    type: 'vocab',
    uri: 'os:',
  },
  qualifier: {
    type: 'vocab',
    uri: 'qf:',
  },
  baseMembershipType: {
    type: 'vocab',
    uri: 'bmt:',
  },
};


// Emulate how vocabs get loaded in the web app
const cannedVocabs = require('./cannedVocabs.json');
const vocabs = new VocabServiceImpl(cannedVocabs, 'EN');

// Emulate how initiatives get loaded in the web app, although we need to hack things a bit
// because we want to feed the data directly in, rather than have DataServices query
// the server with a dataset name.

const cannedData = require('./cannedData.json');
const datasetId = 'testDataset';
const dataservices = new DataServicesImpl(config, phraseBooks);
const aggregator = new DataAggregator(config, fieldSchema, vocabs, {});
aggregator.addBatch(datasetId, cannedData.data);
aggregator.complete(datasetId);

dataservices.vocabs = vocabs; // Hack this into place
dataservices.aggregatedData = aggregator; // Hack this into place

const initiatives = aggregator.initiativesByUid;

describe('The default-popup.ts module', function () {

  const allContent: Dictionary<string> = {};
  Object.entries(initiatives).forEach((ent) => {
    if (ent[1]) {
      const content = getPopup(ent[1], dataservices);
      allContent[ent[0]] = content;
    }
  })

  // To save the generated data in nodejs (under instant-mocha) set:
  // require('fs').writeFileSync('./allContent.json', JSON.stringify(allContent, null, 2));
  
  Object.keys(allContent).forEach((id) => {
    it('should generate the expected content for '+id, () => {
      assert.equal(allContent[id], expectedContent[id]);
    });
  });
});
