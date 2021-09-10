// Defines a very simple registry of named values.
//
// This is a minimal replacement for RequireJS's dependency injection.
// Essentially, add pre-initialised named services first, passing
// the registry itself if they need this to look up other services:
//
//     registries = require('registries');
//     registry = registries.makeRegistry();
//     registry.def("myservice") = require("myservice")(registry);
//
// ...then get the pre-initialised service by name after.
//
//     myservice = registry("myservice");
//

// Makes a new registry object.
function makeRegistry() {
  const index = new Object();

  const registry = (name) => {
    if (!index[name]) {
      throw new Error(`Service '${name}' not yet defined`);
    }

    return index[name];
  };
  
  registry.def = (name, service) => {
    // console.debug("registry.def", name, service);
    if (typeof(name) != 'string') {
      throw new Error(`Service name  is invalid: '${name}'`);
    }
    if (service === null || service === undefined) {
      throw new Error(`Service value for '${name}' is invalid: ${service}`);
    }
    if (name in index && service !== index[name]) {
      // console.debug(`${service} !== ${index[name]}`);
      throw new Error(`Service '${name}' already defined with a different value`);
    }

    return index[name] = service;
  };

  return registry;
}


module.exports = {
  makeRegistry,
};
