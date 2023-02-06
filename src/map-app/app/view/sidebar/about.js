// The view aspects of the About sidebar
"use strict";
const d3 = require('d3');
const eventbus = require('../../eventbus');
const { BaseSidebarView } = require('./base');
const { AboutPresenter } = require('../../presenter/sidebar/about');

function init(registry) {
  const config = registry('config');
  const dataServices = registry('model/dataservices');

  const labels = dataServices.getFunctionalLabels();

  // Our local Sidebar object:
  function Sidebar() { }

  // Our local Sidebar inherits from sidebar:
  var proto = Object.create(BaseSidebarView.prototype);

  // And adds some overrides and new properties of it's own:
  proto.title = "about";
  proto.hasHistoryNavigation = false; // No forward/back buttons for this sidebar

  // TODO These same consts are here and in view/sidebar/initiative.
  //      Find a common place for them.
  const sectionHeadingClasses =
    "w3-bar-item w3-tiny w3-light-grey w3-padding-small";
  const hoverColour = " w3-hover-light-blue";
  const accordionClasses =
    "w3-bar-item w3-tiny w3-light-grey w3-padding-small" + hoverColour;
  const sectionClasses = "w3-bar-item w3-small w3-white w3-padding-small";

  proto.populateFixedSelection = function (selection) {
    let textContent = labels.aboutTitle;
    selection
      .append("div")
      .attr("class", "w3-container")
      .append("h1")
      .text(textContent);
  };

  proto.populateScrollableSelection = function (selection) {
    const that = this;

    const lang = config.getLanguage();
    
    // We need to be careful to guard against weird characters, especially quotes,
    // from the language code, as these can create vulnerabilities.
    if (lang.match(/[^\w -]/))
      throw new Error(`rejecting suspect language code '${lang}'`);
    
    selection
      .append('div')
      .attr("class", "w3-container about-text")
      .html(config.aboutHtml())
    // Remove all elements which have a language tag which is not the target language tag
      .selectAll(`[lang]:not([lang='${lang}'])`)
      .remove();
    
    const dataSection = selection.append('div')
                                 .attr("class", "w3-container about-data");

    
    /*********************************************************************************
     * COMMENTED PENDING A REVIEW/REFRESH OF THE DATA AND WIKI DOCS
    const sourceParag = dataSection.append('p')
    sourceParag.text(labels.source)

    const li = sourceParag
      .append('ul')
      .selectAll('li')
      .data(Object.values(dataServices.getDatasets()))
      .enter()
      .append('li');

    // Different data sources currently need different code here.
    // Ideally make this more uniform later
    li
      .filter(d => d.type !== 'hostSparql') // non hostSparql
      .text(d => d.label);
    
    li
      .filter(d => d.type === 'hostSparql') // The rest is hostSparql specific currently
      .append('a')
      .text(d => d.label)
      .attr('target', '_blank')
          .attr('href', d => {
            console.log(d)
        if (typeof d?.loader?.meta?.default_graph_uri === 'string') {
          // ensure URI has trailing slash, needed for lod.coop
          return d.loader.meta.default_graph_uri.replace(/\/*$/, '/');
        }
        return '#'; // placeholder
      });

    dataSection.append('p')
      .text(labels.technicalInfo);

    const technicalInfoUrl = 'https://github.com/DigitalCommons/mykomap/wiki';
    dataSection
      .append('p')
      .append('a')
      .text(technicalInfoUrl)
      .attr('href', technicalInfoUrl)
      .attr('target', '_blank');

    *********************************************************************************/
    
    // If a version is available display it
    const version = config.getVersionTag();
    if (version) {
      selection
        .append("div")
        .attr("class", "w3-container about-version")
        .append("p")
        .attr("style", "font-style: italic;")
        .text(`mykomap@${version}`);
    }
  };


  Sidebar.prototype = proto;

  proto.hasHistoryNavigation = false;

  function createSidebar() {
    var view = new Sidebar();
    view.setPresenter(new AboutPresenter(view));
    return view;
  }
  return {
    createSidebar: createSidebar
  };
}

module.exports = init;
