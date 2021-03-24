
/*define([
   "model/config",
   "model/sse_initiative",
   "app/console",
   "app/view",
   "app/debug"
   ], function(config, sseInitiative, myconsole, view, debugging) {*/
const config_builder = require('./model/config');
const myconsole = require('./console');
const debugging = require('./debug');

  "use strict";

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

  /** Parse the URL in location.search
   *
   * @returns a list of key/value pairs (each pair is a two element array)
   * The array also has an attribute `values` which is a map of keys to lists of values
   * (there may be zero or more values per key).
   */
  function parseUrlParameters(search) {
    const query = search
          .replace(/^[?]/, '')
          .replace(/#.*/, '');
    const components = query.split(/[&;]/);
    const kvList = components
          .filter(c => c.length > 0) // empty string is not a param
          .map(
            c => c
              .split(/=(.*)/, 2) // split on first =, don't drop
                                 // characters after second =
              .map(kv => decodeURIComponent(kv.replace(/[+]/g, ' ')))
          );
    kvList.values = new Object();
    kvList.forEach(kv => {
      var list = kvList.values[kv[0]];
      if (list === undefined)
        list = kvList.values[kv[0]] = [];
      if (kv.length > 1) {
        list.push(kv[1]);
      }
    });
    return kvList;
  }

  function init(base_config, attrs, urlParams) {
    console.log(
      "TODO - Check the use of console here. Is this the mechanism by which app/console gets used by the rest of the app?"
    );
    console.log(
      "TODO - Check why is app/debug being loaded here - probably a leftover from clone origin."
    );
    console.log(
      "header, footer and left column have been reduce to zero in style.css."
    );

    const config = config_builder(base_config);
    
    // Combine the attributes and the url params (latter override former).
    const combined = Object.assign({}, attrs, urlParams);
    
    // Override any config values passed.
    config.add(combined);

    // The code for each view is loaded by www/app/view.js
    // Initialize the views:
    const view = require('./view')(config);
    view.init();
    // Each view will ensure that the code for its presenter is loaded.

    // Ask the model to load the data for the initiatives:
    const sseInitiative = require('./model/sse_initiative')(config);
    sseInitiative.loadFromWebService();
  }

  function init2(base_config) {
    const mapApp = document.getElementById(base_config.elem_id || 'map-app');
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
            <div class="sea-main-sidebar-inner">
              <div id="map-app-sidebar-header" class="map-app-sidebar-header">
              </div>
            </div>
            <!-- Fixed part of Sidebar that may change for different types of the sidebar (e.g. Search results) -->
            <!-- If this is not a separate flex div, then it doesn't quite render properly on iPhone:
                the bottom of the div slightly overlaps the scrollable section of the sidebar below -->
            <div class="sea-main-sidebar-inner">
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

    const attrs = parseAttributes(mapApp, base_config.attr_namespace || 'map-app');
    // Combine/flatten the parameter array into an object. This will
    // lose duplicates.
    const urlParams = parseUrlParameters(window.location.search)
          .reduce((acc, e) => { acc[e[0]] = e[1]; return acc}, {});

    // Call the main function with the config values to override.
    init(base_config, attrs, urlParams);
  }

module.exports = init2;
//});
