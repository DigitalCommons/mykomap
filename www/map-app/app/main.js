define([
  "model/config",
  "model/sse_initiative",
  "app/console",
  "app/view",
  "app/debug"
], function(config, sseInitiative, myconsole, view, debugging) {
  "use strict";

  function init(cfg = {}) {
    console.log(
      "TODO - Check the use of console here. Is this the mechanism by which app/console gets used by the rest of the app?"
    );
    console.log(
      "TODO - Check why is app/debug being loaded here - probably a leftover from clone origin."
    );
    console.log(
      "header, footer and left column have been reduce to zero in style.css."
    );
    config.add(cfg);

    // The code for each view is loaded by www/app/view.js
    // Initialize the views:
    view.init();
    // Each view will ensure that the code for its presenter is loaded.

    // Ask the model to load the data for the initiatives:
    sseInitiative.loadFromWebService();
  }
  var pub = {
    init: init
  };
  return pub;
});
