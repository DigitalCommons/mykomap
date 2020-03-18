"use strict";
requirejs.config({
  //appDir: "map-app",
  // baseUrl is relative to appDir.
  // By default, load modules from the lib directory:
  baseUrl: "map-app/lib",
  // except, if the module ID starts with "app",
  // load it from the app directory. Paths
  // config is relative to the baseUrl, and
  // never includes a ".js" extension since
  // the paths config could be for a directory.
  paths: {
    app: "../app",
    view: "../app/view",
    stubview: "../app/stubview", // for testing
    model: "../app/model",
    presenter: "../app/presenter",
    data: "../app/data",

    configuration: "../../configuration",
    
    //jQuery: "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0-beta1/jquery.min",
    //topojson: "http://d3js.org/topojson.v1.min",
    //topojson: "https://cdnjs.cloudflare.com/ajax/libs/topojson/1.6.19/topojson.min",

    // d3 version 3:
    // If we want to load D3 from a local source:
    //d3: "d3.v3.min"
    // To load from CDN:
    //d3: "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.16/d3.min",

    // d3 version 5:
    d3: "https://cdnjs.cloudflare.com/ajax/libs/d3/5.7.0/d3.min",

    // d3 v5 provides separate modules, if we want to use these
    // in order to load only what we need.For example:
    //"d3-dsv": "https://cdnjs.cloudflare.com/ajax/libs/d3-dsv/1.0.8/d3-dsv.min",
    //"d3-fetch": "https://d3js.org/d3-fetch.v1.min",

    // postal (eventbus) depends on lodash.
    postal: "postal",

    // postal.lodash.js is packaged with postal.js.
    // But it produces an error. See https://github.com/postaljs/postal.js/issues/182
    // lodash: "postal.lodash",
    //
    // So, I've used the core one direct from lodash:
    // https://raw.githubusercontent.com/lodash/lodash/4.17.10-npm/core.js
    lodash: "lodash.core",

    leaflet: "leaflet",
    leafletAwesomeMarkers: "leaflet.awesome-markers.min",
    leafletMarkerCluster: "leaflet.markercluster-src-1.4.1",
    leafletActiveArea: "leaflet.activearea",

    // For expressing dependencies on json files:
    json: "require/json",
    // json uses the text module, se we need it too:
    text: "require/text",
  },
  shim: {
    // leaflet must be loaded before leafletAwesomeMarkers.
    // See http://requirejs.org/docs/api.html#config-shim
    // Note that this assumes that leafletAwesomeMarkers is NOT an AMD module.

    // Following: https://github.com/lvoogdt/Leaflet.awesome-markers/issues/57:
    leaflet: {
      exports: "L"
    },
    leafletAwesomeMarkers: {
      deps: ["leaflet"]
    },
    leafletMarkerCluster: {
      deps: ["leaflet"]
    },
    leafletActiveArea: {
      deps: ["leaflet"]
    }
  }
});

requirejs(["app/main"], function(main) {
  "use strict";
  console.log("app/main.js has been loaded");

  /** Convert names-like-this into namesLikeThis
   */
  function snakeToCamelCase(string) {
    return string.replace(/-([^-])/g, (m, p1) => p1.toUpperCase());
  }

  /** Parse attributes from an element, convert snake-case names to camelCase
   *
   * If a namespace is supplied, then only attributes prefied by this are returned.
   *
   * @return an object containing the matching attribute names (converted) and values
   * (as is).
   */
  function parseAttributes(elem, namespace = '') {
    if (namespace !== '') {
      namespace = namespace+':';
    }

    const config = {};
    for(var ix = 0; ix < elem.attributes.length; ix += 1) {
      const attr = elem.attributes[ix];
      console.log("attr", attr);
      if (attr.name.indexOf(namespace) != 0)
        continue;
      const name = snakeToCamelCase(attr.name.substring(namespace.length));
      console.log("adding", name, attr.value);
      config[name] = attr.value;
    }

    return config;
  }


  const mapApp = document.getElementById("map-app");
  mapApp.innerHTML = `
		<!-- Page Content -->
		<div class="w3-teal map-app-content">
			<!-- Sidebar -->
			<div class="sea-sidebar" style="flex-direction:column;" id="map-app-sidebar">
				<!--  Button to show sidebar -->
				<div id="map-app-sidebar-button" class="map-app-sidebar-button">
				</div>
        <div class="w3-bar-block sea-initiatives-list-sidebar" id="sea-initiatives-list-sidebar">
          <div class="sea-initiatives-list-sidebar-content" id="sea-initiatives-list-sidebar-content">
          </div>
				</div>
				<div class="w3-bar-block sea-main-sidebar">
					<div style="flex: 0 1 auto;">
						<div id="map-app-sidebar-header" class="map-app-sidebar-header">
						</div>
					</div>
					<!-- Fixed part of Sidebar that may change for different types of the sidebar (e.g. Search results) -->
					<!-- If this is not a separate flex div, then it doesn't quite render properly on iPhone:
							the bottom of the div slightly overlaps the scrollable section of the sidebar below -->
					<div style="flex: 0 1 auto;">
						<div id="map-app-sidebar-fixed-section" class="map-app-sidebar-fixed-section "></div>
					</div>
					<!-- scrollable part of sidebar -->
					<!-- occupies the remaining vertical space, with scrollbar added if needed. -->
					<div id="map-app-sidebar-scrollable-section" class="map-app-sidebar-scrollable-section">
					</div>
        </div>
        <div class="w3-bar-block sea-initiative-sidebar" id="sea-initiative-sidebar">
          <div class="sea-initiative-sidebar-content" id="sea-initiative-sidebar-content">
          </div>
        </div>
      </div>
			<div class="map-app-map-container" id="map-app-leaflet-map">
			</div>
			<div class="w3-display-container map-app-display-container">
				<!--  Search box -->
				<div id="map-app-search-widget">
				</div>
			</div>
    </div>`;

  const attrs = parseAttributes(mapApp, 'map-app');
  
  main.init(attrs);
});
