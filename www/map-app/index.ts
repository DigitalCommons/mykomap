"use strict";

import type { Dictionary } from "./common_types";
import type { SseInitiative } from "./app/model/sse_initiative";

import { init as config_builder, ConfigData, Config } from './app/model/config';
import { makeRegistry, Registry } from './app/registries';

/** Convert names-like-this into namesLikeThis
 */
export function snakeToCamelCase(str: string): string {
  return str.replace(/-([^-])/g, (m, p1) => p1.toUpperCase());
}

/** Parse attributes from an element, convert snake-case names to camelCase
 *
 * If a namespace is supplied, then only attributes prefied by this are returned.
 *
 * @return an object containing the matching attribute names (converted) and values
 * (as is).
 */
export function parseAttributes(elem: HTMLElement, namespace: string = ''): Dictionary {
  if (namespace !== '') {
    namespace = namespace+':';
  }

  const config: Dictionary = {};
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

export type UrlParams = [string, string][] & { keyMap: Dictionary<string[]> };

/** Parse the URL in location.search
 *
 * @returns a list of key/value pairs (each pair is a two element array)
 * The array also has an attribute `keyMap` which is a map of keys to lists of values
 * (there may be zero or more values per key).
 */
export function parseUrlParameters(search: string): UrlParams {
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
    ) as UrlParams;
  kvList.keyMap = new Object() as Dictionary<string[]>;
  kvList.forEach(kv => {
    var list = kvList.keyMap[kv[0]];
    if (list === undefined)
      list = kvList.keyMap[kv[0]] = [];
    if (kv.length > 1) {
      list.push(kv[1]);
    }
  });
  return kvList;
}


// Create an initialised module registry.
//
// `config` should be a config object created using `model/config.js`
export function initRegistry(config: Config): Registry {
  const registry: Registry = makeRegistry();
  
  registry.def('config', config);
  registry.def('model/sse_initiative',
               require('./app/model/sse_initiative').init(registry));

  // Register the view/presenter modules so they can find each other.
  // The order matters insofar that dependencies must come before dependants.
  registry.def('view/base', require('./app/view/base'));
  registry.def('presenter', require('./app/presenter'));
  registry.def('view/map/popup', require('./app/view/map/default_popup'));
  registry.def('presenter/map/marker', require('./app/presenter/map/marker')(registry));
  registry.def('view/map/marker', require('./app/view/map/marker').init(registry));
  registry.def('presenter/map', require('./app/presenter/map')(registry));
  registry.def('view/map', require('./app/view/map')(registry));
  registry.def('presenter/searchbox', require('./app/presenter/searchbox')(registry));
  registry.def('view/searchbox', require('./app/view/searchbox')(registry));
  registry.def('view/sidebar/base', require('./app/view/sidebar/base'));    
  registry.def('presenter/sidebar/base', require('./app/presenter/sidebar/base')(registry));
  registry.def('presenter/sidebar/about', require('./app/presenter/sidebar/about')(registry));
  registry.def('presenter/sidebar/directory', require('./app/presenter/sidebar/directory')(registry));
  registry.def('presenter/sidebar/datasets', require('./app/presenter/sidebar/datasets')(registry));
  registry.def('presenter/sidebar/initiatives', require('./app/presenter/sidebar/initiatives')(registry));
  registry.def('presenter/sidebar', require('./app/presenter/sidebar')(registry));
  registry.def('view/sidebar/about', require('./app/view/sidebar/about')(registry));
  registry.def('view/sidebar/directory', require('./app/view/sidebar/directory')(registry));
  registry.def('view/sidebar/datasets', require('./app/view/sidebar/datasets')(registry));
  registry.def('view/sidebar/initiatives', require('./app/view/sidebar/initiatives')(registry));
  registry.def('view/sidebar', require('./app/view/sidebar')(registry));
  registry.def('presenter/sidebar/mainmenu', require('./app/presenter/sidebar/mainmenu')(registry));
  
  // The code for each view is loaded by www/app/view.js
  // Initialize the views:
  registry.def('view', require('./app/view.js')(registry));

  return registry;
};


export async function fetchConfigs(params?: {
    configJson?: string,
    versionJson?: string,
    aboutHtml?: string,
}): Promise<ConfigData> {
    const {
	configJson = "configuration/config.json",
	versionJson = "configuration/version.json",
	aboutHtml =  "configuration/about.html",
    } = params || {};
    const config = fetch(configJson);
    const versions = fetch(versionJson);
    const about = fetch(aboutHtml);
    const detectErrors = (r: any) => {
	// We don't throw an error as I can't seem to catch individual exceptions in the
	// promise chain below correctly, without a 'Pause on exceptions'
	// breakpoint firing and fouling the page load, or the load
	// fouling anyway (for another reason?)
	return r.ok? false : new Error(`Request failed: ${r.status} (${r.statusText})`);
    };
    const getJson = (r: any) => detectErrors(r) || r.json();
    const getText = (r: any) => detectErrors(r) || r.text();

    return Promise
	.all([config.then(getJson), versions.then(getJson), about.then(getText)])
	.then(([config, versions, about]) => {
	    if (about instanceof Error) {
		console.info("Using blank 'about' text as about.html inaccessible.", about.message);
		console.debug("Ignored fetch error", about);
		about = '';
	    }
	    const combinedConfig = { ...config, ...versions, aboutHtml: about };
	    return combinedConfig;
	});

}

// Start the application in the context fo a web page
//
// `window` should be the browser window, with a `document` property, or something
// which emulates this adequately (for testing).
//
// `base_config` is the base config, but which may have settings overridden by
// settings defined either in the configured element's attributes, or the URL paramters.
export function webRun(window: Window, base_config: ConfigData): void {
  const target: string = base_config.elem_id || 'map-app';
  const mapApp: HTMLElement | null = window.document.getElementById(target);
  if (mapApp === null)
    throw new Error(`No target element ${target} found in this web page`);

  const iconDefs = `
      <!-- Icon -->
      <svg xmlns="http://www.w3.org/2000/svg" style="display: none"
           >
        <defs>
          <style>.cls-1{fill:#3c00ce;}</style>
          <symbol id="svg-icon-shadow" class="svg-icon-shadow" viewBox="0 0 28 42">
            <filter
               id="filter3967"
               style="color-interpolation-filters:sRGB;">
              <feFlood
                 id="feFlood3953"
                 result="flood"
                 flood-color="rgb(255,255,255)"
                 flood-opacity="1" />
              <feColorMatrix
                 id="feColorMatrix3955"
                 result="colormatrix1"
                 values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -0.2125 -0.7154 -0.0721 1 0 "
                 in="SourceGraphic" />
              <feGaussianBlur
                 id="feGaussianBlur3957"
                 result="blur"
                 stdDeviation="10.06 6.43"
                 in="colormatrix1" />
              <feColorMatrix
                 id="feColorMatrix3959"
                 result="colormatrix2"
                 values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1.2 -0.3 "
                 in="blur" />
              <feBlend
                 id="feBlend3961"
                 result="blend"
                 mode="normal"
                 in2="BackgroundImage"
                 in="colormatrix2" />
              <feComposite
                 id="feComposite3963"
                 result="composite1"
                 k2="1"
                 operator="arithmetic"
                 in2="blend"
                 in="blend" />
              <feComposite
                 id="feComposite3965"
                 operator="in"
                 in2="SourceGraphic" />
            </filter>
            <path
               transform="matrix(0.94542347,0,0,1.010613,6.081143,8.0833578)"
               style="opacity:1;vector-effect:none;fill:#000000;fill-opacity:1;stroke-width:0.852301;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1;"
               d="M 8.3759894,33.560465 C 41.074971,15.559798 37.660691,3.0509515 24.288309,3.0509515 c -13.372381,0 -29.8347074,12.5088455 -15.9123196,30.5095135 z"
               id="path845" />
          </symbol>
          <symbol id="svg-icon" class="svg-icon" viewBox="0 0 28 42">
            <path
              class="svg-icon-path"
              d="M 14,6.4e-7 C 0.62761898,6.4e-7 -9.3106853,17.219925 14,42 37.310685,17.219926 27.372381,6.4e-7 14,6.4e-7 Z" />
          </symbol>
        </defs>
        <!-- to make the svg-icon.svg file
             also usable as image: -->
        <use href="#svg-icon"/>
      </svg>
`;
  mapApp.innerHTML = iconDefs+`
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

  const attrs = parseAttributes(mapApp, base_config.attr_namespace || '');
  // Combine/flatten the parameter array into an object. This will
  // lose duplicates.
  const urlParams = parseUrlParameters(window.location.search)
    .reduce((acc, e) => { acc[e[0]] = e[1]; return acc}, {} as Dictionary);

  // Build the base_config into a config object
  const config = config_builder(base_config);
  
  // Combine the attributes and the url params into a single object (latter override former).
  const combined: Dictionary = Object.assign({} as Dictionary, attrs, urlParams);
  
  // Override any config values with the url/attribute params 
  config.add(combined);

  // Get the registry of modules. This manages module dependencies,
  // and is a hang-over from when we used requireJS.
  const registry = initRegistry(config);
  
  const view = registry('view') as { init: () => void };
  const sseInitiative = registry('model/sse_initiative') as SseInitiative;
  
  // Each view will ensure that the code for its presenter is loaded.
  view.init();

  // Ask the model to load the data for the initiatives:
  sseInitiative.loadFromWebService();
}

