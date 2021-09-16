"use strict";

// Dynamic entry point for sea-map sites.
//
// This loads the config/version/about files dynamically, partly for historical reasons
// (as they were before we used webpack), but also so they can be queried (by shipshape)
// and updated manually in a deployed site when necessary.
//
// Specify this as an entry point in webpack as "sea-map/www/map-app/app.js"

const main = require("./app/main");
const config = fetch("/configuration/config.json");
const versions = fetch("/configuration/version.json");
const about = fetch("/configuration/about.html");
const getJson = (r) => r.json();
const getText = (r) => r.text();
Promise
  .all([config.then(getJson), versions.then(getJson), about.then(getText)])
  .then(([config, versions, about]) => {
    const combinedConfig = { ...config, ...versions, aboutHtml: about };
    main.webRun(window, combinedConfig);
  });
