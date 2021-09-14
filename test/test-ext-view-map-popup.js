// This test assumes that the ica-project repo is linked via /ext
// and is in the right version!

'use strict';
const { assert } = require('chai');
const config = require('../www/map-app/app/model/config')({});

const registry = require('../www/map-app/app/registries').makeRegistry();
registry.def('config', config);

const sse_initiative = require('../www/map-app/app/model/sse_initiative')(registry);

// Emulate how vocabs get loaded in the web app
sse_initiative.setVocab(require('./cannedVocabs.json'));

// Emulate how initiatives get loaded in the web app
sse_initiative.addInitiatives(require('./cannedData.json').data);
sse_initiative.finishInitiativeLoad();
const initiatives = sse_initiative.getInitiativeUIDMap();

describe('The external popup.js module', function () {
  const popup = require('../ext/config/popup');
  const expectedContent = require('./expected/popups/ica.json');

  const allContent = {};
  Object.entries(initiatives).forEach((ent) => {
    const content = popup.getPopup(ent[1], sse_initiative);

    allContent[ent[0]] = content;
  })

  // To save the generated data in nodejs (under instant-mocha) set:
  //require('fs').writeFileSync('./allContent.json', JSON.stringify(allContent, null, 2));
  
  Object.keys(allContent).forEach((id) => {
    it('should generate the expected content for '+id, () => {
      assert.equal(allContent[id], expectedContent[id]);
    });
  });
});

