// Set up the various sidebars
import { EventBus } from '../../eventbus';
import * as d3 from 'd3';
import { SidebarPresenter } from '../presenter/sidebar';
import { BaseView } from './base';
import { Dictionary } from '../../common_types';
import { BaseSidebarView } from './sidebar/base';
import { AboutSidebarPresenter } from '../presenter/sidebar/about';
import { BaseSidebarPresenter } from '../presenter/sidebar/base';
import { DirectorySidebarPresenter } from '../presenter/sidebar/directory';
import { InitiativesSidebarPresenter } from '../presenter/sidebar/initiatives';
import { DatasetsSidebarPresenter } from '../presenter/sidebar/datasets';

export class SidebarView extends BaseView {
  sidebarName?: string;
  children: Dictionary<BaseSidebarPresenter> = {};
  
  constructor(readonly presenter: SidebarPresenter,
              readonly sidebarButtonColour: string ) {
    super();
    this.sidebarButtonColour = sidebarButtonColour;
    
    this.createOpenButton();
    this.createButtonRow();
    this.createSidebars();
    this.changeSidebar(); // Use the default
  }

  createOpenButton() {
    this.d3selectAndClear("#map-app-sidebar-button")
      .append("button")
      .attr("class", "w3-btn")
      .attr("style","background-color: " + this.sidebarButtonColour)
      .attr("title", this.presenter.mapui.labels?.showDirectory ?? '')
      .on("click", () => this.showSidebar())
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
      .attr("title", labels?.showDirectory ?? '')
      .on("click", () => {
        EventBus.Map.removeSearchFilter.pub();
        //notify zoom
        this.changeSidebar("directory");
        this.showInitiativeList();

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
      .attr("title", labels?.showSearch ?? '')
      .on("click", () => {
        this.hideInitiativeList();
        //deselect
        EventBus.Markers.needToShowLatestSelection.pub([]);
        EventBus.Initiatives.showSearchHistory.pub();
        this.changeSidebar("initiatives");
      })
      .append("i")
      .attr("class", "fa fa-search");
    }

    if (this.presenter.showingAbout()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", labels?.showInfo ?? '')
      .on("click", () => {
        this.hideInitiativeList();
        EventBus.Markers.needToShowLatestSelection.pub([]);
        this.changeSidebar("about");
      })
      .append("i")
      .attr("class", "fa fa-info-circle");
    }

    if (this.presenter.showingDatasets()) {
      selection
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", labels?.showDatasets ?? '')
        .on("click", () => {
          this.hideInitiativeList();
          EventBus.Markers.needToShowLatestSelection.pub([]);
          this.changeSidebar("datasets");
        })
        .append("i")
        .attr("class", "fa fa-database");
    }


  }

  createSidebars() {
    this.children = {};
    
    if(this.presenter.showingDirectory())
      this.children.directory = new DirectorySidebarPresenter(this.presenter);

    if(this.presenter.showingSearch())
      this.children.initiatives = new InitiativesSidebarPresenter(this.presenter);

    if(this.presenter.showingAbout())
      this.children.about = new AboutSidebarPresenter(this.presenter);
    
    if(this.presenter.showingDatasets())
      this.children.datasets = new DatasetsSidebarPresenter(this.presenter);
  }

  // Changes or refreshes the sidebar
  //
  // @param name - the sidebar to change (needs to be one of the keys
  // of this.sidebar)
  changeSidebar(name?: string) {
    if (name !== undefined) {
      // Validate name
      if (!(name in this.children)) {
        console.warn(`ignoring request to switch to non-existant sidebar '${name}'`);
        name = undefined;
      }
    }

    if (name === undefined) {
      // By default, use the first sidebar defined (JS key order is that of first definition)
      const names = Object.keys(this.children);
      
      if (names.length === 0)
        return; // Except in this case, there is nothing we can do!

      name = names[0];
    }
    
    // Change the current sidebar
    this.sidebarName = name;
    this.children[this.sidebarName]?.refreshView();
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
        //select input textbox if possible 
        if (document.getElementById("search-box") != null)
          document.getElementById("search-box")?.focus();
        this.updateSidebarWidth();
      },
      false
    )
      .classed("sea-sidebar-open", true);
    
    if (!sidebar.classed("sea-sidebar-list-initiatives"))
      d3.select(".w3-btn").attr("title", this.presenter.mapui.labels?.hideDirectory ?? '');
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-left");

    this.changeSidebar(); // Refresh the content of the sidebar
    if (document.getElementById("dir-filter") && window.outerWidth >= 1080)
      document.getElementById("dir-filter")?.focus();
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
    d3.select(".w3-btn").attr("title", this.presenter.mapui.labels?.showDirectory ?? '');
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
    const sidebarButton = d3.select("#map-app-sidebar-button");
    d3.select(".w3-btn").attr("title", this.presenter.mapui.labels?.hideDirectory ?? '');

    const initiativeListSidebar = d3.select("#sea-initiatives-list-sidebar");
    if (!initiativeListSidebar.empty() && !sidebarButton.empty())
      initiativeListSidebar.insert(() => sidebarButton.node(), // moves sidebarButton
                                   "#sea-initiatives-list-sidebar-content");

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
    const sidebarButton = d3.select("#map-app-sidebar-button");
    sidebar.insert(() => sidebarButton.node(), // moves sidebarButton
                   "#sea-initiatives-list-sidebar");
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

    d3.select(".w3-btn").attr("title", this.presenter.mapui.labels?.hideDirectory ?? '');
  }  
}
