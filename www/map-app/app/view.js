"use strict";
const d3 = require('d3');
const mapAppStyles = require('../map-app.css');

function _init(registry) {
  const config = registry('config');
  const map = registry('view/map');
  const sidebar = registry('view/sidebar');
  const searchbox = registry('view/searchbox');
  
  function init() {
    const title = config.htmlTitle();
    if (title) {
      d3.select("html")
        .select("head")
        .select("title")
        .text(title);
    }
    // @todo - make obsolete
    d3.select("#about-btn")
      .attr("title", "See information about this app in new tab")
      .on("click", function() {
        window.open(
          "https://github.com/p6data-coop/ise-linked-open-data/blob/master/map-app/README.md",
          "_blank"
        );
      });

    map.init();
    //searchbox.init();
    sidebar.init();
  }
  
  return {
    init: init
  };
}
module.exports = _init;
