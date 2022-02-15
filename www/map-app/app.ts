"use strict";

// Dynamic entry point for sea-map sites.
//
// This loads the config/version/about files dynamically, partly for historical reasons
// (as they were before we used webpack), but also so they can be queried (by shipshape)
// and updated manually in a deployed site when necessary.
//
// The paths are deliberately relative, to allow sea-map applications to be deployed at
// arbitrary paths.
//
// Specify this as an entry point in webpack as "sea-map/www/map-app/app.js"

const main = require("./app/main");
const config = fetch("configuration/config.json");
const versions = fetch("configuration/version.json");
const about = fetch("configuration/about.html");
const detectErrors = (r: any) => {
  // We don't throw an error as I can't seem to catch individual exceptions in the
  // promise chain below correctly, without a 'Pause on exceptions'
  // breakpoint firing and fouling the page load, or the load
  // fouling anyway (for another reason?)
  return r.ok? false : new Error(`Request failed: ${r.status} (${r.statusText})`);
};
const getJson = (r: any) => detectErrors(r) || r.json();
const getText = (r: any) => detectErrors(r) || r.text();

Promise
  .all([config.then(getJson), versions.then(getJson), about.then(getText)])
  .then(([config, versions, about]) => {
    if (about instanceof Error) {
      console.info("Using blank 'about' text as about.html inaccessible.", about.message);
      console.debug("Ignored fetch error", about);
      about = '';
    }
    const combinedConfig = { ...config, ...versions, aboutHtml: about };
    main.webRun(window, combinedConfig);
  });
