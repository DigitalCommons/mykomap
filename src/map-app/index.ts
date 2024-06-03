import type { Dictionary } from "./common-types";
import { DataServicesImpl } from "./app/model/data-services";
import { functionalLabels } from './localisations';
import { init as config_builder, ConfigData } from './app/model/config';
import { initUI } from './app/ui';

/** Convert names-like-this into namesLikeThis
 */
export function snakeToCamelCase(str: string): string {
  return str.replace(/-([^-])/g, (_, p1) => p1.toUpperCase());
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

  mapApp.innerHTML = `
      <!-- Page Content -->
      <div class="w3-teal map-app-content">

        <!-- Sidebar -->
        <div class="sea-sidebar" style="flex-direction:column;" id="map-app-sidebar">

          <!--  Button to show sidebar -->
          <div id="map-app-sidebar-button" class="map-app-sidebar-button">
          </div>
          
          <!--  Panel in sidebar which shows filtered results. This doesn't always show and can be closed. -->
          <div class="w3-bar-block sea-initiatives-list-sidebar" id="sea-initiatives-list-sidebar">
            <div class="sea-initiatives-list-sidebar-content" id="sea-initiatives-list-sidebar-content">
            </div>
          </div>

          <!-- Fixed part of sidebar. Content depends on what is chosen in the sidebar header (e.g. directory, search) -->
          <div class="w3-bar-block sea-main-sidebar">
            
            <div class="sea-main-sidebar-inner">
              <div id="map-app-sidebar-header" class="map-app-sidebar-header">
              </div>
            </div>

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
        
        <!-- the actual Leaflet map -->
        <div class="map-app-map-container" id="map-app-leaflet-map">
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

  const dataServices =  new DataServicesImpl(config, functionalLabels);
  
  // Expose the data for debugging
  /// @ts-ignore
  window.mapUI = initUI(config, dataServices);

  // Ask the model to load the data for the initiatives:
  dataServices.loadData();
}

