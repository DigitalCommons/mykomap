// The view aspects of the About sidebar
"use strict";
const d3 = require('d3');
const eventbus = require('../../eventbus');

function init(registry) {
  const config = registry('config');
  const sidebarView = registry('view/sidebar/base');
  const sseInitiative = registry('model/sse_initiative');
  const presenter = registry('presenter/sidebar/about');

  const labels = sseInitiative.getFunctionalLabels();

  // Our local Sidebar object:
  function Sidebar() { }

  // Our local Sidebar inherits from sidebar:
  var proto = Object.create(sidebarView.base.prototype);

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
    //selection.append('div').attr("class", "w3-container w3-center").append('p').text("Information about this map will be available here soon.");
    //selection.append('div').attr("class", "w3-container w3-center").html(that.presenter.aboutHtml());
    
    const aboutSection = selection.append('div')
      .attr("class", "w3-container");

    aboutSection.append('h3')
      .text(labels.underConstruction);

    const sourceSentence = aboutSection.append('p')
      .text(labels.source);

    sourceSentence.append('a')
      .text(labels.here)
      .attr('href','https://dev.lod.coop/ica/');

    sourceSentence.append('span')
      .text('.');

    const furtherInfo = aboutSection.append('p')
      .text(labels.technicalInfo);
    
    furtherInfo.append('a')
      .text(labels.here)
      .attr('href','https://github.com/SolidarityEconomyAssociation/sea-map/wiki');

    furtherInfo.append('span')
      .text('.');

     //if version is available display it
    if (that.presenter.getSoftwareVersion().version) {
      selection
        .append("div")
        .attr("class", "w3-container")
        .append("p")
        .text("SEA Map Version: " + that.presenter.getSoftwareVersion().version);
    }
  };


  Sidebar.prototype = proto;

  proto.hasHistoryNavigation = false;

  function createSidebar() {
    var view = new Sidebar();
    view.setPresenter(presenter.createPresenter(view));
    return view;
  }
  return {
    createSidebar: createSidebar
  };
}

module.exports = init;
