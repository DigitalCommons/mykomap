// Set up the various sidebars
import { EventBus } from '../../eventbus';
import * as d3 from 'd3';
import { SidebarPresenter } from '../presenter/sidebar';
import { BaseView } from './base';
import { canDisplayInitiativePopups } from '../../utils';
import { Initiative } from '../model/initiative';

export class SidebarView extends BaseView {
  
  constructor(readonly presenter: SidebarPresenter,
              readonly sidebarButtonColour: string ) {
    super();
    this.sidebarButtonColour = sidebarButtonColour;
    
    this.createOpenButton();
    this.createButtonRow();
  }

  createOpenButton() {
    this.d3selectAndClear("#map-app-sidebar-button")
      .append("button")
      .attr("class", "w3-btn")
      .attr("style","background-color: " + this.sidebarButtonColour)
      .attr("title", this.presenter.mapui.labels.showDirectory)
      .on("click", () => this.presenter.showSidebar())
      .append("i")
      .attr("class", "fa fa-angle-right");
  }

  createButtonRow() {
    const selection = this.d3selectAndClear("#map-app-sidebar-header");
    const labels = this.presenter.mapui.labels;
    // This is where the navigation buttons will go.
    // These are recreated when the sidebar is changed, e.g. from MainMenu to initiatives.
    selection.append("span")
             .attr("id", "map-app-sidebar-history-navigation")
             .classed("map-app-sidebar-history-navigation");
    
    // The sidebar has a button that causes the main menu to be dispayed

    if (this.presenter.showingDirectory()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto")
      .attr("title", labels.showDirectory)
      .on("click", () => {
        this.presenter.mapui.clearFiltersAndSearch();
        this.hideInitiativeList();
        this.presenter.changeSidebar("directory");

        //deselect
        EventBus.Markers.needToShowLatestSelection.pub([]);
      })
      .append("i")
      .attr("class", "fa fa-bars");
    }
    
    if (this.presenter.showingSearch()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", labels.showSearch)
      .on("click", () => {
        this.presenter.changeSidebar("initiatives");
        document.getElementById("search-box")?.focus();
      })
      .append("i")
      .attr("class", "fa fa-search");
    }

    if (this.presenter.showingAbout()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", labels.showInfo)
      .on("click", () => {
        this.hideInitiativeList();
        EventBus.Markers.needToShowLatestSelection.pub([]);
        this.presenter.changeSidebar("about");
      })
      .append("i")
      .attr("class", "fa fa-info-circle");
    }

    if (this.presenter.showingDatasets()) {
      selection
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", labels.showDatasets)
        .on("click", () => {
          this.hideInitiativeList();
          EventBus.Markers.needToShowLatestSelection.pub([]);
          this.presenter.changeSidebar("datasets");
        })
        .append("i")
        .attr("class", "fa fa-database");
    }


  }

  showSidebar() {
    const sidebar = d3.select("#map-app-sidebar");
    sidebar.on(
      "transitionend",
      (event: TransitionEvent) => {
        const target = event.target as HTMLElement|undefined; // Seems to need coercion
        if (!target || target?.className === "w3-btn") return;
        if (event.propertyName === "transform") {
            d3.select("#map-app-sidebar-button").on("click", () => this.hideSidebar());
        }
        this.updateSidebarWidth();
      },
      false
    )
      .classed("sea-sidebar-open", true);
    
    if (!sidebar.classed("sea-sidebar-list-initiatives"))
      d3.select(".w3-btn").attr("title", this.presenter.mapui.labels.hideDirectory);
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-left");

    this.presenter.changeSidebar(); // Refresh the content of the sidebar
  }

  updateSidebarWidth() {
    const sidebar = d3.select("#map-app-sidebar").node();
    const initiativeListSidebar = d3.select("#sea-initiatives-list-sidebar").node();
    if (!(sidebar instanceof HTMLElement && initiativeListSidebar instanceof HTMLElement))
      return;

    const sidebarBounds = sidebar.getBoundingClientRect();
    const initiativeListBounds = initiativeListSidebar.getBoundingClientRect();
    
    // Assumptions
    // - initiativeListBounds and directoryBounds can exchange positions
    // - the right-most of either is the left edge of the active area of the map
    // - this position is therefore the offset to send in the event
    const initRight = initiativeListBounds.x + initiativeListBounds.width;
    const sidebarRight = sidebarBounds.x + sidebarBounds.width;
    const offset = Math.max(initRight, sidebarRight);
    EventBus.Map.setActiveArea.pub({ offset });
  }
  
  // This should be split into three functions:
  // 1. Close the sidebar regardless of current view
  // 2. Close the Initiatives list
  // 3. Close the Initiative sidebar
  hideSidebar() {
    //this.hideInitiativeList();
    const sidebar = d3.select("#map-app-sidebar");

    sidebar
      .on(
        "transitionend",
        (event: TransitionEvent) => {
          const target = event.target as HTMLElement|undefined; // Seems to need coercion
          if (target?.className === "w3-btn") return;
          if (event.propertyName === "transform" && target) {
            d3.select("#map-app-sidebar-button").on("click", () => this.showSidebar());
            this.updateSidebarWidth();
            // More coercion seems to be required here
            (window as unknown as {_seaSidebarClosing: boolean})._seaSidebarClosing = true;
          }
        },
        false
      )
      .classed("sea-sidebar-open", false);
    d3.select(".w3-btn").attr("title", this.presenter.mapui.labels.showDirectory);
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-right");

  }

  hideInitiativeSidebar() {
    const initiativeSidebar = d3.select("#sea-initiative-sidebar");
    const node = initiativeSidebar.node();
    
    if (node instanceof HTMLElement && node?.getBoundingClientRect().x === 0) {
      initiativeSidebar.classed("sea-initiative-sidebar-open", false);
    }
  }

  showInitiativeList() {
    //if empty don't show
    const empty = d3.select("#sea-initiatives-list-sidebar-content").select("ul").empty();
    if (empty) {
      return;
    }
    //else show it
    const sidebar = d3.select("#map-app-sidebar");
    d3.select(".w3-btn").attr("title", this.presenter.mapui.labels.hideDirectory);

    sidebar
      .on(
        "transitionend",
        (event: TransitionEvent) => {
          const target = event.target as HTMLElement|undefined; // Seems to need coercion
          if (target?.className === "w3-btn") return;
          if (event.propertyName === "transform" && target) {
              this.updateSidebarWidth();
          }
        },
        false
      )
      .classed("sea-sidebar-list-initiatives", true);
  }
  
  hideInitiativeList() {
    const sidebar = d3.select("#map-app-sidebar");
    
    sidebar.on(
      "transitionend",
      (event: TransitionEvent) => {
        const target = event.target as HTMLElement|undefined; // Seems to need coercion
        if (target?.className === "w3-btn") return;
        if (event.propertyName === "transform" && target) {
            this.updateSidebarWidth();
        }
      },
      false
    )
      .classed("sea-sidebar-list-initiatives", false);

    d3.select(".w3-btn").attr("title", this.presenter.mapui.labels.hideDirectory);
  }

  populateInitiativeSidebar(initiative: Initiative, initiativeContent: string) {
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");
    let initiativeContentElement = this.d3selectAndClear(
      "#sea-initiative-sidebar-content"
    );
    initiativeContentElement
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button")
      .attr("title", `${this.presenter.mapui.labels.close} ${initiative.name}`)
      .on("click", () => EventBus.Map.initiativeClicked.pub(undefined))
      .append("i")
      .attr("class", "fa " + "fa-times");
    initiativeContentElement
      .append("div")
      .html(initiativeContent);
    initiativeSidebar.classed("sea-initiative-sidebar-open", true);

    if (!canDisplayInitiativePopups())
      EventBus.Sidebar.showSidebar.pub();
  }
}
