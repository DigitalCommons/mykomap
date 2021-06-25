// Using the postal.js publish/subscribe event bus.
// See https://github.com/postaljs/postal.js
//
define(["postal"], function(postal) {
  "use strict";

  // TODO - If we need to configure postal for our use, do it here
  /* This example reports all events
  var tap = postal.addWireTap( function( d, e ) {
    console.log("POSTAL:", e);
  });
  */
  // For now, we expose all of postal as the interface to our eventbus
  return postal;
});
