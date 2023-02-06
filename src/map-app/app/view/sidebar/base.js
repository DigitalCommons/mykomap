// Set up the various sidebars
"use strict";
const d3 = require('d3');
const eventbus = require('../../eventbus')
const { BaseView } = require('../base');

/// Base class of all sidebar views
export class BaseSidebarView extends BaseView {
  static {
    // Add these properties to the prototype - thus shared by all
    // derived classes. This is somewhat unorthodox, but is a closest
    // translation from what was implemented before this was converted
    // into a ES class.
    
    this.prototype.title = "Untitled";

    // true by default - change this in derived sidebar view objects if necessary.
    this.prototype.hasHistoryNavigation = true; 

    this.prototype.hasCloseButton = true;
  }

  constructor() {
    super();
  }
  
  populateScrollableSelection(selection) {
    // override this default in derived view objects:
  }

  populateFixedSelection(selection) {
    // override this default in derived view objects:
  }

  loadFixedSection() {
    this.populateFixedSelection(
      this.d3selectAndClear("#map-app-sidebar-fixed-section")
    );
  }

  loadScrollableSection() {
    this.populateScrollableSelection(
      this.d3selectAndClear("#map-app-sidebar-scrollable-section")
    );
  }

  loadCloseButton() {}

  loadHistoryNavigation() {
    // Fwd/back navigation for moving around the contentStack of a particular sidebar
    // (e.g. moving between different search results)
    var buttons = this.presenter.historyNavigation();
    //w3-button
    var buttonClasses = "w3-white w3-cell w3-border-0";
    var selection = this.d3selectAndClear(
      "#map-app-sidebar-history-navigation"
    );
    
    const createButton = (b, faClass, hovertext) => {
      selection
        .append("button")
      // Minor issue: if we add the class w3-mobile to these buttons, then each takes up a whole line
      // on an iPhone, instad of being next to each other on the same line.
        .attr("class", buttonClasses + (b.disabled ? " w3-disabled" : ""))
        .attr("title", hovertext)
        .on("click", () => {
          b.onClick();
          this.presenter.deselectInitiatives();
          //hide initiatives
        })
        .append("i")
        .attr("class", "fa " + faClass);
    }
    if (this.hasHistoryNavigation) {
	    createButton(buttons.back, "fa-arrow-left", "Earlier search results");
	    createButton(buttons.forward, "fa-arrow-right", "Later search results");
    }
  }

  refresh() {
    this.loadFixedSection();
    this.loadHistoryNavigation(); // back and forward buttons
    this.loadScrollableSection();
  }

}


