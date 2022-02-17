/**
 *
 * The purpose of this module is to insulate the rest of the application from
 * changes made to the format of config_json, version_json, etc.
 *
 * It returns an object with accessor methods for obtaining configured data.
 */

//"use strict";

import { ConfigSchema, ConfigData, Getter, Setter, configSchema as config_schema } from './config_schema';

interface Accessors {
  [id: string]: {
    get: Getter;
    set?: Setter;
  }
}

interface Methods {
  [id: string]: Getter | Setter;
}

export function init(inits: any) {
  const accessors: Accessors = {}; // config setters and getters, indexed by id, then by 'get' or 'set'
  const methods: Methods = {}; // Exported methods
  const data: ConfigData = {}; // The config data, indexed by id

  const configSchema: ConfigSchema[] = config_schema(inits);

  // Dynamically construct the config object from the schema
  configSchema.forEach((def) => {
    // Defaults.
    let getterName = def.id;
    let getter = def.getter;

    // Define getters by default.
    // Adjust the getter based on the config schema
    if (typeof (getter) === 'function') {
      if (getter.name
          && getter.name !== 'anonymous') {
        // A named function, use its name.
        getterName = getter.name;
      }
	
      // A function, bind it's `this` to data.
      getter = getter.bind(data) as Getter;
    }
    else if (typeof (getter) === 'string') {
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
    accessors[def.id] = { get: getter };

    // Allow setters to be defined, but not by default
    if (def.setter !== undefined) {
      let setter = def.setter;
      let setterName;

      // Adjust the setter based on the config schema
      if (typeof (setter) === 'function') {
        if (setter.name
            && setter.name !== 'anonymous') {
          // A named function, use its name.
          setterName = setter.name;
        }
	  
        // A function, bind it's `this` to data.
        setter = setter.bind(data) as Setter;
      }
      else if (typeof (setter) === 'string') {
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
  methods.add = (cfg: ConfigData) => {
    if (typeof (cfg) !== 'object')
      throw new Error(`argument to add must be an object`);
    
    // Parse string values as approriate for the config value in question.
    cfg = parseStrings(cfg);
    
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

  return methods;
}

/** Parses an object mapping config ids to string values into an object with parsed values
 *
 * Parsing is done using the schema's type's parseString method, if present.
 * Otherwise the value is left as a string.
 * @param an object containing the string ids.
 * @returns the new object containing the parsed values.
 */
function parseStrings(cfg: ConfigData): ConfigData {
  const result: ConfigData = {};
  const configSchema = config_schema({});

  Object.keys(cfg).forEach(id => {
    const def = configSchema.find((e) => id === e.id);
    result[id] = (def && def.type && def.type.parseString) ?
                 def.type.parseString(cfg[id]) : cfg[id];
  });
  return result;
};

