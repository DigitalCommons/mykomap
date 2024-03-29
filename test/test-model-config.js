'use strict';
//const fs = require('fs');
import { assert } from 'chai';
import { init as configBuilder } from '../src/map-app/app/model/config';

// Emulate what happens in ../src/map-app/app.js
import rawConfig from './configs/typical/config.json';
import version from './configs/typical/version.json';
const about = `This is a dummy about.html!
`;
//fs.readFileSync('test/configs/typical/about.html');
const combinedConfig = { ...rawConfig, ...version, aboutHtml: about };

describe('The config.js module', function () {
  context('given a typical config', function () {
    var config = configBuilder(combinedConfig);

    it('should return the configured values', function () {
      assert.equal(config.aboutHtml(), 'This is a dummy about.html!\n');
      assert.equal(config.getSoftwareVariant(), 'testing!');
      assert.equal(config.getSoftwareTimestamp(), '2020-06-13T18:38:04+0100');
      assert.equal(config.getSoftwareGitCommit(), 'fb9982f');
      assert.deepEqual(config.getDataSources(), [
        {
          id: "test-dataset",
          label: "Test Dataset",
          type: "hostSparql"
        }
      ]);
      assert.equal(config.htmlTitle(), 'Test Title');
      assert.equal(config.getShowDatasetsPanel(), true);
      assert.equal(config.getInitialBounds(), undefined);
      assert.deepEqual(config.getDefaultLatLng(), ['55.55', '66.66']);
      assert.deepEqual(config.getFilterableFields(), ["primaryActivity"]);
      assert.equal(config.doesDirectoryHaveColours(), true);
      assert.equal(config.getDisableClusteringAtZoom(), 10);
      assert.deepEqual(config.getSearchedFields(), ['name']);
      assert.equal(config.getMaxZoomOnGroup(), 12);
      assert.equal(config.getMaxZoomOnOne(), 14);
      assert.equal(config.getMaxZoomOnSearch(), 12);
      assert.equal(config.logo(), undefined);
    });
  });
});
