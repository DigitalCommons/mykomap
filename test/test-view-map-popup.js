'use strict';
const { assert } = require('chai');
const config = require('../www/map-app/app/model/config')({});

const registry = require('../www/map-app/app/registries').makeRegistry();
registry.def('config', config);

const dataservices = require('../www/map-app/app/model/dataservices')(registry);

// Emulate how vocabs get loaded in the web app
dataservices.setVocab(require('./cannedVocabs.json'));

// Emulate how initiatives get loaded in the web app
dataservices.addInitiatives(require('./cannedData.json').data);
dataservices.finishInitiativeLoad();
const initiatives = dataservices.getInitiativeUIDMap();

describe('The default_popup.js module', function () {
  const popup = require('../www/map-app/app/view/map/default_popup');
  const expectedContent = require('./expected/popups/default.json');

  const allContent = {};
  Object.entries(initiatives).forEach((ent) => {
    const content = popup.getPopup(ent[1], dataservices);
    allContent[ent[0]] = content;
  })

  // To save the generated data in nodejs (under instant-mocha) set:
  // require('fs').writeFileSync('./allContent.json', JSON.stringify(allContent, null, 2));
  
  Object.keys(allContent).forEach((id) => {
    it('should generate the expected content for '+id, () => {
      assert.equal(allContent[id], expectedContent[id]);
    });
  });
});
