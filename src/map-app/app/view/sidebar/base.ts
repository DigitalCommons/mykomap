// Set up the various sidebars
import { BaseSidebarPresenter, NavigationCallback } from '../../presenter/sidebar/base';
import {  BaseView  } from '../base';
import { d3DivSelection, d3Selection } from '../d3-utils';
import { toString as _toString } from '../../../utils';
import { EventBus } from "../../../eventbus";

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

  /**
   * Refreshes the sidebar view
   * 
   * @param changed true if we changed to this sidebar, false if it was already showing and we're
   * just refreshing it.
   */
  refresh(changed: boolean) {
    this.loadFixedSection();
    this.loadHistoryNavigation(); // back and forward buttons
    this.loadScrollableSection();
    this.refreshSearchResults();
  }

  /**
   * Display a list of all initiatives that match the current filters, in a separate pane to the
   * right of the sidebar or, if on mobile, in the sidebar.
   */
  refreshSearchResults() {
    const appState = this.presenter.parent.mapui.currentItem();
    const labels = this.presenter.parent.mapui.labels;
    const initiatives = Array.from(appState.visibleInitiatives);

    const selection = this.d3selectAndClear("#sea-initiatives-list-sidebar-content");
    const initiativesListSidebarHeader = selection.append("div").attr("class", "initiatives-list-sidebar-header");
    
    this.createInitiativeListSidebarHeader(initiativesListSidebarHeader)

    selection
      .append("p")
      .classed("filter-count", true)
      .text(initiatives.length ? `${initiatives.length} ${labels.matchingResults}`: labels.nothingMatched);
  
    const list = selection.append("ul").classed("sea-initiatives-list", true);
    for (let initiative of initiatives) {
      let activeClass = "";
      let nongeoClass = "";
      if (this.presenter.parent.mapui.isSelected(initiative)) {
        activeClass = "sea-initiative-active";
      }

      if (!initiative.hasLocation()) {
        nongeoClass = "sea-initiative-non-geo";
      }

      list
        .append("li")
        .text(_toString(initiative.name))
        .attr("data-uid", _toString(initiative.uri))
        .classed(activeClass, true)
        .classed(nongeoClass, true)
        .on("click", ()=> this.presenter.onInitiativeClicked(initiative))
        .on("mouseover", () => this.presenter.onInitiativeMouseoverInSidebar(initiative))
        .on("mouseout", () => this.presenter.onInitiativeMouseoutInSidebar(initiative));
    }
  }

  private createInitiativeListSidebarHeader(container: d3DivSelection) {
    const labels = this.presenter.parent.mapui.labels;

    if (this.presenter.parent.showingDirectory()) {
      container
        .append("button")
        // mobile only since these buttons already exist in the sidebar on larger screens
        .attr("class", "w3-button w3-border-0 mobile-only")
        .attr("title", labels.showDirectory)
        .on("click", function () {
          EventBus.Sidebar.hideInitiativeList.pub();
          EventBus.Sidebar.showDirectory.pub();
          EventBus.Map.resetSearch.pub();
          EventBus.Markers.needToShowLatestSelection.pub([]);
        })
        .append("i")
        .attr("class", "fa fa-bars");
    }

    if (this.presenter.parent.showingSearch()) {
      container
        .append("button")
        .attr("class", "w3-button w3-border-0 mobile-only")
        .attr("title", labels.showSearch)
        .on("click", function () {
          EventBus.Sidebar.hideInitiativeList.pub();
          EventBus.Sidebar.showInitiatives.pub();
          document.getElementById("search-box")?.focus();
        })
        .append("i")
        .attr("class", "fa fa-search");
    }

    container
      .append("p")
      .attr("class", "ml-auto clear-filters-button")
      .text(labels.clearFilters)
      .on("click", () => {
        EventBus.Sidebar.hideInitiativeList.pub();
        EventBus.Map.resetSearch.pub();
        EventBus.Markers.needToShowLatestSelection.pub([]);
      })
  }
}
