"use strict";

/* Definitions for the Custom Element <map-app>
 */

(function() {
  /*!
   * Run event after the DOM is ready
   * (c) 2017 Chris Ferdinandi, MIT License, https://gomakethings.com
   * @param  {Function} fn Callback function
   */
  var ready = function(fn) {
    // Sanity check
    if (typeof fn !== "function") return;

    // If document is already loaded, run method
    if (
      document.readyState === "interactive" ||
      document.readyState === "complete"
    ) {
      return fn();
    }

    // Otherwise, wait until document is loaded
    document.addEventListener("DOMContentLoaded", fn, false);
  };

  ready(function() {
    if (!this.map_initialized) {
      this.map_initialized = true;

      // Get require.js to load the app:
      // <script data-main="app" src="lib/require.js"></script>
      const loader = document.createElement("script");
      const dataMain = document.createAttribute("data-main");
      dataMain.value = "map-app/app.js";
      loader.setAttributeNode(dataMain);
      const src = document.createAttribute("src");
      src.value = "map-app/lib/require.js";
      loader.setAttributeNode(src);
      document.body.appendChild(loader);
    }
  });
})();
