"use strict";

// Dynamic entry point for mykomap sites.
//
// This loads the config/version/about files dynamically, partly for historical reasons
// (as they were before we used webpack), but also so they can be queried (by shipshape)
// and updated manually in a deployed site when necessary.
//
// The paths are deliberately relative, to allow mykomap applications to be deployed at
// arbitrary paths.
//
// Specify this as an entry point in webpack as "mykomap/src/map-app/app.js"

import { webRun, fetchConfigs } from "./index";

fetchConfigs().then(combinedConfig => webRun(window, combinedConfig));
