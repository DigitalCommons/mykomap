/**
 *
 * The purpose of this module is to insulate the rest of the application from
 * changes made to the format of config_json, version_json, etc.
 *
 * It returns an object with accessor methods for obtaining configured data.
 */


define([
  "json!configuration/config",
  "json!configuration/version.json",
  "text!configuration/about.html!strip",
], function(config_json, version_json, about_html) {
  "use strict";

  /* Define the config schema using a list of field meta-data, from
   * which we construct the object. This allows a lot of flexibility
   * and introspection.
   *
   * Schema fields:

   * id: A unique identifier to be used in config object attributes,
   * amongst other places.
   *
   * descr: A brief description.
   *
   * init: An optional function to call to initialise the default
   * value. Otherwise it is unset.
   *
   * getter: Optionally a string naming the value getter method, or a
   * method function to call to get it (in which `this` is the config
   * object). If one is defined, the name of the function will be used
   * as the name of the getter. If this value is unset, the getter
   * method has the same name as the id.
   */
  const configSchema = [
    { id: 'aboutHtml',
      descr: `Raw HTML definition of the map's "about" text`,
      init: () => about_html,
    },
    { id: 'servicesPath',
      descr: 'Preset location of the data source script(s)',
      init: () => 'services/',
      getter: 'getServicesPath',
    },
    { id: 'variant',
      descr: 'The name of the variant used to generate this map application',
      init: () => version_json.variant,
      getter: 'getSoftwareVariant',
    },
    { id: 'timestamp',
      descr: 'A timestamp indicating when this application was deployed',
      init: () => version_json.timestamp,
      getter: 'getSoftwareTimestamp',
    },
    { id: 'gitcommit',
      descr: 'The git commit-ID of the sea-map source code deployed',
      init: () => version_json.gitcommit,
      getter: 'getSoftwareGitCommit',
    },
    { id: 'namedDatasets',
      descr: 'These names correspond to directories in www/services which contain '+
      'default-graph-uri.txt, endpoint.txt, query.rq',
      init: () => config_json.namedDatasets,
    },
    { id: 'htmlTitle',
      descr: `If set, this will override the default value for the map's HTML <title> tag`,
      init: () => config_json.htmlTitle,
    },
    { id: 'defaultNongeoLatLng',
      descr: 'The default latitude and longitude values (as a '+
      '`{lat: <string>, lng: <string>}` object) for initiatives with no address; '+
      'defaults to `{lat: undefined, lng: undefined}`',
      init: () => config_json.defaultNongeoLatLng,
      getter: function getNongeoLatLng() {
        return this.defaultNongeoLatLng?
          this.defaultNongeoLatLng  : { lat: undefined, lng: undefined };
      },
    },
    { id: 'initialBounds',
      descr: 'The initial bounds of the map; these are chosen automatically if this is unset',
      init: () => config_json.initialBounds,
      getter: 'getInitialBounds',
    },
    { id: 'filterableFields',
      descr: 'Defines the fields that can populate the directory',
      init: () => config_json.filterableFields,
      getter: 'getFilterableFields',
    },
    { id: 'doesDirectoryHaveColours',
      descr: 'True if the directory should feature coloured entries',
      init: () => config_json.doesDirectoryHaveColours,
    },
    { id: 'disableClusteringAtZoom',
      descr: 'Defines the zoom level to stop clustering at (an integer; or false for off)',
      init: () => config_json.disableClusteringAtZoom,
      getter: 'getDisableClusteringAtZoom',
    },
  ];

  console.log(version_json);
  console.log(about_html);
  
  const methods = {};
  const data = {};

  // Dynamically construct the config object from the schema
  configSchema.forEach((def) => {
    // Defaults.
    let getterName = def.id;
    let getter = def.getter;

    // Adjust the getter based on the config schema
    if (typeof(getter) === 'function') {
      // A function, bind it's `this` to data.
      getter = def.getter.bind(data); 
      if (getter.name
          && getter.name !== 'anonymous') {
        // A named function, use its name.
        getterName = def.getter.name;
      }
    }
    else if (typeof(getter) === 'string') {
      // A string, use it as the getter name and a default getter implementation.
      getterName = getter;
      getter = () => data[def.id];
    }
    else if (getter === undefined) {
      // Unset, use defaults
      getter = () => data[def.id];
    }
    else {
      // Anything else...
      throw new Error(`config schema for ${def.id}.getter must be a string or a function`);
    }
    
    methods[getterName] = getter;

    // Initialise the config value
    if (def.init) {
      data[def.id] = def.init();
    }
  });
  
  return methods; // hides the data by closing over it
});
