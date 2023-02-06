"use strict";
const d3 = require('d3');
const mapAppStyles = require('../map-app.css');

function _init(registry) {
  const config = registry('config');
  const lang = config.getLanguage();

  const mapView = registry('view/map');
  
  function init() {
    // We need to be careful to guard against weird characters, especially quotes,
    // from the language code, as these can create vulnerabilities.
    if (lang.match(/[^\w -]/))
      throw new Error(`rejecting suspect language code '${lang}'`);
    
    let title = config.htmlTitle();
    const about = config.aboutHtml();
    
    if (!title && about) {
      // Look for a title tag in about.html

      // Create a temp node to inspect the about html
      const temp =
        d3.select("head")
          .insert("div") // make a temp node
          .html(about) // insert the whole text temporarily

      // Try title[lang=$lang] first
      let tempTitleNode =
        temp.select(`title[lang='${lang}']`);

      // Fall back to title with no lang attribute
      if (tempTitleNode.empty())
        tempTitleNode = temp.select('title:not([lang])');

      if (!tempTitleNode.empty())
        title =
          tempTitleNode.text(); // Get the text

      // Remove the temp node
      temp.remove();
    }

    // Set the title, if available
    if (title) {
      const titleNode = d3.select("html head title");
      titleNode.text(title);
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

    mapView.createMap();
  }
  
  return {
    init: init
  };
}
module.exports = _init;
