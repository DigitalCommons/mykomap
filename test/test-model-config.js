'use strict';
var assert = require('assert');



describe('The config.js module', function () {
  describe('given a typical config', function () {
    var config;

    var requirejs = require("requirejs");
    requirejs.config({
	    baseUrl: 'www/map-app/lib',
	    nodeRequire: require,

	    // Stripped-down adaptation of config in www/map-app/app.js
	    paths: {
	      app: "../app",
	      model: "../app/model",

	      // Link to our test config
	      configuration: "../../../test/configs/typical",
	      
	      // For expressing dependencies on json files:
	      json: "require/json",
	      // json uses the text module, se we need it too:
	      text: "require/text",
	    },
    });
    
    before(function (done) {
      // Credit to: https://stackoverflow.com/questions/20473614/mocha-requirejs-amd-testing
      // This saves the module config for use in tests. You have to use
      // the done() callback because this is asynchronous.
      requirejs(['model/config'],
                function(_config) {
                  config = _config;
                  //console.log(">>", config);
                  done();
                });
    });

    it('should return the configured values', function () {
      assert.equal(config.aboutHtml(), 'This is a dummy about.html!\n');
      assert.equal(config.getSoftwareVariant(), 'testing!');
      assert.equal(config.getSoftwareTimestamp(), '2020-06-13T18:38:04+0100');
      assert.equal(config.getSoftwareGitCommit(), 'fb9982f');
      assert.deepEqual(config.namedDatasets(), ['test-dataset']);
      assert.equal(config.namedDatasetsVerbose(), undefined);
      assert.equal(config.htmlTitle(), 'Test Title');
      assert.equal(config.getShowDatasetsPanel(), true);
      assert.equal(config.getInitialBounds(), undefined);
      assert.deepEqual(config.getDefaultLatLng(), ['55.55', '66.66']);
      assert.deepEqual(config.getFilterableFields(), [{ "field": "primaryActivity", "label": "Activities" }]);
      assert.equal(config.doesDirectoryHaveColours(), true);
      assert.equal(config.getDisableClusteringAtZoom(), 10);
      assert.deepEqual(config.getSearchedFields(), ['name', 'www']);
      assert.equal(config.getMaxZoomOnGroup(), 12);
      assert.equal(config.getMaxZoomOnOne(), 14);
      assert.equal(config.getMaxZoomOnSearch(), 12);
      assert.equal(config.logo(), undefined);
    });
  });
});
