// Set up the various sidebars
import { BaseSidebarPresenter, NavigationCallback } from '../../presenter/sidebar/base';
import {  BaseView  } from '../base';
import { d3Selection } from '../d3-utils';

/// Base class of all sidebar views
export abstract class BaseSidebarView extends BaseView {
  static readonly sectionHeadingClasses =
    "w3-bar-item w3-tiny w3-light-grey w3-padding-small";
  static readonly hoverColour = " w3-hover-light-blue";
  static readonly accordionClasses =
    "w3-bar-item w3-tiny w3-light-grey w3-padding-small" + BaseSidebarView.hoverColour;
  static readonly sectionClasses = "w3-bar-item w3-small w3-white w3-padding-small";


  
  abstract readonly presenter: BaseSidebarPresenter;
  
  // true by default - change this in derived sidebar view objects if necessary.
  hasHistoryNavigation: boolean = true; 
  hasCloseButton: boolean = true;

  abstract readonly title: string;

  constructor() {
    super();
  }
  
  abstract populateScrollableSelection(selection: d3Selection): void;

  abstract populateFixedSelection(selection: d3Selection): void;

  loadFixedSection(): void {
    this.populateFixedSelection(
      this.d3selectAndClear("#map-app-sidebar-fixed-section")
    );
  }

  loadScrollableSection(): void {
    this.populateScrollableSelection(
      this.d3selectAndClear("#map-app-sidebar-scrollable-section")
    );
  }

  loadCloseButton(): void {}

  loadHistoryNavigation(): void {
    // Fwd/back navigation for moving around the contentStack of a particular sidebar
    // (e.g. moving between different search results)
    const backButton = {
      disabled: this.presenter.isBackButtonDisabled(),
      onClick: () => this.presenter.onBackButtonClick(),
    };
    const forwardButton = {
      disabled: this.presenter.isForwardButtonDisabled(),
      onClick: () => this.presenter.onForwardButtonClick(),
    };

    //w3-button
    var buttonClasses = "w3-white w3-cell w3-border-0";
    var selection = this.d3selectAndClear(
      "#map-app-sidebar-history-navigation"
    );
    
    const createButton = (b: NavigationCallback, faClass: string, hovertext: string) => {
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
	    createButton(backButton, "fa-arrow-left", "Earlier search results");
	    createButton(forwardButton, "fa-arrow-right", "Later search results");
    }
  }

  refresh() {
    this.loadFixedSection();
    this.loadHistoryNavigation(); // back and forward buttons
    this.loadScrollableSection();
  }

}


