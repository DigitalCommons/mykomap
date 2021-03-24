// Set up the various sidebars
//define(["app/eventbus", "d3", "view/base"], function(eventbus, d3, view) {
  "use strict";
const d3 = require('d3');
const eventbus = require('../../eventbus')
const view = require('../../view/base');

  // base is the "base class" of all sidebars:
  function base() {}

  // sidebars inherit from view.base:
  var proto = Object.create(view.base.prototype);

  // add properties to sidebar:
  proto.title = "Untitled";
  proto.hasHistoryNavigation = true; // by default - change this in derived sidebar view objects if necessary.
  proto.hasCloseButton = true;

  proto.populateScrollableSelection = function(selection) {
    // override this default in derived view objects:
  };
  proto.populateFixedSelection = function(selection) {
    // override this default in derived view objects:
  };

  proto.loadFixedSection = function() {
    this.populateFixedSelection(
      this.d3selectAndClear("#map-app-sidebar-fixed-section")
    );
  };
  proto.loadScrollableSection = function() {
    this.populateScrollableSelection(
      this.d3selectAndClear("#map-app-sidebar-scrollable-section")
    );
  };
  proto.loadCloseButton = function() {};
  proto.loadHistoryNavigation = function() {
    // Fwd/back navigation for moving around the contentStack of a particular sidebar
    // (e.g. moving between different search results)
    var buttons = this.presenter.historyNavigation();
    //w3-button
    var buttonClasses = "w3-white w3-cell w3-border-0";
    var selection = this.d3selectAndClear(
      "#map-app-sidebar-history-navigation"
    );
    var that = this;
    
      function createButton(b, faClass, hovertext) {
        selection
          .append("button")
        // Minor issue: if we add the class w3-mobile to these buttons, then each takes up a whole line
        // on an iPhone, instad of being next to each other on the same line.
        .attr("class", buttonClasses + (b.disabled ? " w3-disabled" : ""))
        .attr("title", hovertext)
        .on("click", function() {
          b.onClick();
          that.presenter.deselectInitiatives();
          //hide initiatives
        })
        .append("i")
        .attr("class", "fa " + faClass);
    }
    if (this.hasHistoryNavigation) {
	    createButton(buttons.back, "fa-arrow-left", "Earlier search results");
	    createButton(buttons.forward, "fa-arrow-right", "Later search results");
    }
  };
  proto.refresh = function() {
    this.loadFixedSection();
    this.loadHistoryNavigation(); // back and forward buttons
    this.loadScrollableSection();
  };
  base.prototype = proto;

  var pub = {
    base: base
  };
  module.exports = pub;
//});
