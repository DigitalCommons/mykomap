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

  /** Define config value types, and certain helper functions.
   *
   * parseString should accept a string and return a parsed value
   * suitable for the config item of associated type.
   */
  const types = {
    boolean: {
      // Parse '', 'false', or 'no' as false, everything else as true.
      parseString: (val) => {
        switch(val.toLowerCase()) {
        case '':
        case 'false':
        case 'no':
          return false;
        default:
          return true;        
        }
      },
    },
    string: {
      // No-op
      parseString: (val) => val,
    },
    latLng:  {
      // Parse as a list of 2 comma-delimited numbers.
      // Like: "<latitude>,<longitude>"
      // Drop trailing numbers
      parseString: (val) =>
        val.split(',', 2).map(s => isNaN(s)? 0 : Number(s)),
    },
    latLng2:  {
      // Parse as a list of 4 comma-delimited numbers.
      // Like: "<latitude1>,<longitude1>,<latitude2>,<longitude2>"
      // Drop trailing numbers
      parseString: (val) => {
        const e = val.split(',', 4).map(s => isNaN(s)? 0 : Number(s));
        return [[e[0],e[1]],[e[2],e[3]]];
      },
    },
    arrayOfString:  {
      // Parse as comma-delimited values.
      // NB doesn't handle escaping, so no ',' possible in strings
      // Spaces are considered significant - they are not trimmed.
      parseString: (val) => val.split(/,/),
    },
  };
  
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
      setter: 'setHtmlTitle',
      type: types.string,
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
      setter: 'setDefaultNongeoLatLng',
      type: types.latLng,
    },
    { id: 'initialBounds',
      descr: 'The initial bounds of the map as an array: [[n1,e1],[n2,e2]]; '+
      'these are chosen automatically if this is unset',
      init: () => config_json.initialBounds,
      getter: 'getInitialBounds',
      setter: 'setInitialBounds',
      type: types.latLng2,
    },
    { id: 'filterableFields',
      descr: 'Defines the fields that can populate the directory',
      init: () => config_json.filterableFields,
      getter: 'getFilterableFields',
      setter: 'setFilterableFields',
      type: types.arrayOfString,
    },
    { id: 'doesDirectoryHaveColours',
      descr: 'True if the directory should feature coloured entries',
      init: () => config_json.doesDirectoryHaveColours,
      setter: 'setDirectoryHasColours',
      type: types.boolean,
    },
    { id: 'disableClusteringAtZoom',
      descr: 'Defines the zoom level to stop clustering at (an integer; or false for off)',
      init: () => config_json.disableClusteringAtZoom,
      getter: 'getDisableClusteringAtZoom',
      setter: 'setDisableClusteringAtZoom',
      type: types.boolean,
    },
  ];

  console.log(version_json);
  console.log(about_html);

  const accessors = {}; // config setters and getters, indexed by id, then by 'get' or 'set'
  const methods = {}; // Exported methods
  const data = {}; // The config data, indexed by id

  // Dynamically construct the config object from the schema
  configSchema.forEach((def) => {
    // Defaults.
    let getterName = def.id;
    let getter = def.getter;

    accessors[def.id] = {};
    
    // Define getters by default.
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
    accessors[def.id].get = getter;
    
    // Allow setters to be defined, but not by default
    if (def.setter !== undefined) {
      let setter = def.setter;
      let setterName;
      
      // Adjust the setter based on the config schema
      if (typeof(setter) === 'function') {
        // A function, bind it's `this` to data.
        setter = setter.bind(data); 
        if (setter.name
            && setter.name !== 'anonymous') {
          // A named function, use its name.
          setterName = setter.name;
        }
      }
      else if (typeof(setter) === 'string') {
        // A string, use it as the getter name and a default getter implementation.
        setterName = setter;
        setter = (val) => { data[def.id] = val };
      }
      else {
        // Anything else defined...
        throw new Error(`config schema for ${def.id}.setter must be a string or a function`);
      }

      methods[setterName] = setter;
      accessors[def.id].set = setter;
    }

    // Initialise the config value
    if (def.init) {
      data[def.id] = def.init();
    }
  });


  // Define an 'add' method, which sets any settable items in the
  // object passed to the init function
  methods.add = (cfg) => {
    if (typeof(cfg) !== 'object')
      throw new Error(`argument to add must be an object`);
    console.log("add", cfg);    
    Object.keys(cfg).forEach(id => {
      const def = configSchema.find((e) => id === e.id);
      if (!def) {
        console.log(`ignoring invalid config item ${id}`);
        return;
      }
      
      const setter = accessors[id].set;
      if (!setter) {
        console.log(`ignoring unsettable config item ${id}`);
        return;
      }
      
      setter.call(data, cfg[id]);
    });
  };

  /** Parses an object mapping config ids to string values into an object with parsed values
   *
   * Parsing is done using the schema's type's parseString method, if present.
   * Otherwise the value is left as a string.
   * @param an object containing the string ids.
   * @returns the new object containing the parsed values.
   */
  methods.parseStrings = (cfg) => {
    const result = {};

    Object.keys(cfg).forEach(id => {
      const def = configSchema.find((e) => id === e.id);
      result[id] = (def && def.type && def.type.parseString)?
        def.type.parseString(cfg[id]) : cfg[id];
    });
    return result;
  };
  
  return methods; // hides the data by closing over it
});
