/**
 * RequireJS plugin for optional module loading.
 * 
 * Allows us to define module dependencies such as
 * 'app/optional!some/such' which when not present do not prevent
 * requireJS from building - instead the injected dependency variable
 * is undefined.
 *
 *
 * Adapted from: http://stackoverflow.com/a/27422370/434799
 */

define("optional", [], {
  load : function (moduleName, parentRequire, onload, config) {
    
    // This the module definition to use if the optional one is absent
    function stubModule() {
      return undefined;
    }
    
    var onLoadFailure = function(err){
      // The optional module failed to load.
      var failedId = err.requireModules && err.requireModules[0];
      
      console.warn(failedId + ": this optional module is absent, using a stub");

      // Undefine the module to cleanup internal stuff in requireJS
      requirejs.undef(failedId);

      // Now define the module instance as a simple empty object
      // (NOTE: you can return any other value you want here)
      define(failedId, [], stubModule);

      // Now require the module make sure that requireJS thinks 
      // that is it loaded. Since we've just defined it, requirejs 
      // will not attempt to download any more script files and
      // will just call the onLoadSuccess handler immediately
      parentRequire([failedId], onload);
    }

    try {
      // This may throw at build time:
      parentRequire([moduleName], onload, onLoadFailure);
    }
    catch(e) {
      // We're in NodeJS at build time, so we can check the error code.
      if (e.code !== "ENOENT")
        throw e; // rethrow other kinds of errors, probably the user should know!

      // It's a file-not-found error, which we want to suppress.
      
      // Make RequireJS happy at build time if the module is absent
      console.warn(moduleName + " module is absent, a stub will be used");

      // Undefine the module to cleanup internal stuff in RequireJS
      requirejs.undef(moduleName);

      // Now define the module instance as a stub
      define(moduleName, [], stubModule);

      // Call onload on the stub
      onload(stubModule);
    }
  }
});
