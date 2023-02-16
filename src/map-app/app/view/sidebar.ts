// Set up the various sidebars
import * as eventbus from '../eventbus';
import * as d3 from 'd3';
import { SidebarPresenter } from '../presenter/sidebar';
import { AboutSidebarView } from '../view/sidebar/about';
import { BaseView } from './base';
import { DatasetsSidebarView } from './sidebar/datasets';
import { DirectorySidebarView } from './sidebar/directory';
import { InitiativesSidebarView } from './sidebar/initiatives';
import { MarkerViewFactory } from './map/marker';
import { MapPresenterFactory } from '../presenter/map';
import { DataServices } from '../model/dataservices';
import { Dictionary } from '../../common_types';
import { Config } from '../model/config';
import { BaseSidebarView } from './sidebar/base';

export class SidebarView extends BaseView {
  readonly presenter: SidebarPresenter;
  sidebarName?: string;
  sidebar: Dictionary<BaseSidebarView> = {};
  
  constructor(readonly labels: Dictionary,
              readonly config: Config,
              readonly dataServices: DataServices,
              readonly markerView: MarkerViewFactory,
              readonly mapPresenterFactory: MapPresenterFactory,
              readonly sidebarButtonColour: string ) {
    super();
    this.labels = labels;
    this.config = config;
    this.dataServices = dataServices;
    this.markerView = markerView;
    this.mapPresenterFactory = mapPresenterFactory;
    this.sidebarButtonColour = sidebarButtonColour;

    this.presenter = new SidebarPresenter(
      this,
      this.config.getShowDirectoryPanel(),
      this.config.getShowSearchPanel(),
      this.config.getShowAboutPanel(),
      this.config.getShowDatasetsPanel()
    );
    
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
      .attr("title", this.labels?.showDirectory ?? '')
      .on("click", () => this.showSidebar())
      .append("i")
      .attr("class", "fa fa-angle-right");
  }

  createButtonRow() {
    const selection = this.d3selectAndClear("#map-app-sidebar-header");

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
      .attr("title", this.labels?.showDirectory ?? '')
      .on("click", () => {
        eventbus.publish({
          topic: "Map.removeSearchFilter",
          data: {}
        });
        //notify zoom
        this.changeSidebar("directory");
        this.showInitiativeList();

        //deselect 
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
      })
      .append("i")
      .attr("class", "fa fa-bars");
    }
    
    if (this.presenter.showingSearch()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", this.labels?.showSearch ?? '')
      .on("click", () => {
        this.hideInitiativeList();
        //deselect
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        eventbus.publish({
          topic: "Initiatives.showSearchHistory",
        });
        this.changeSidebar("initiatives");
      })
      .append("i")
      .attr("class", "fa fa-search");
    }

    if (this.presenter.showingAbout()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", this.labels?.showInfo ?? '')
      .on("click", () => {
        this.hideInitiativeList();
        // eventbus.publish({
        // topic: "Map.removeSearchFilter"});
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        this.changeSidebar("about");
      })
      .append("i")
      .attr("class", "fa fa-info-circle");
    }

    if (this.presenter.showingDatasets()) {
      selection
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", this.labels?.showDatasets ?? '')
        .on("click", () => {
          this.hideInitiativeList();
          // eventbus.publish({
          //   topic: "Map.removeSearchFilter",
          //   });
          eventbus.publish({
            topic: "Markers.needToShowLatestSelection",
            data: {
              selected: []
            }
          });
          this.changeSidebar("datasets");
        })
        .append("i")
        .attr("class", "fa fa-database");
    }


  }

  createSidebars() {

    this.sidebar = {};

    if(this.presenter.showingDirectory())
      this.sidebar.directory = new DirectorySidebarView(this, this.labels, this.config, this.dataServices, this.markerView);

    if(this.presenter.showingSearch())
      this.sidebar.initiatives = new InitiativesSidebarView(this, this.config, this.labels, this.dataServices, this.mapPresenterFactory);

    if(this.presenter.showingAbout())
      this.sidebar.about = new AboutSidebarView(this, this.labels, this.config);
    
    if(this.presenter.showingDatasets())
      this.sidebar.datasets = new DatasetsSidebarView(this, this.labels, this.dataServices);
  }

  // Changes or refreshes the sidebar
  //
  // @param name - the sidebar to change (needs to be one of the keys
  // of this.sidebar)
  changeSidebar(name?: string) {
    if (name !== undefined) {
      // Validate name
      if (!(name in this.sidebar)) {
        console.warn(`ignoring request to switch to non-existant sidebar '${name}'`);
        name = undefined;
      }
    }

    if (name === undefined) {
      // By default, use the first sidebar defined (JS key order is that of first definition)
      const names = Object.keys(this.sidebar);
      
      if (names.length === 0)
        return; // Except in this case, there is nothing we can do!

      name = names[0];
    }
    
    // Change the current sidebar
    this.sidebarName = name;
    this.sidebar[this.sidebarName]?.refresh();
  }

  // hideSidebarIfItTakesWholeScreen() {
  //   // @todo - improve this test -
  //   // it is not really testing the predicate suggested by the name iof the function.
  //   if (window.outerWidth <= 600) {
  //     d3.select("#map-app-sidebar").classed("sea-sidebar-open", false);
  //     d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-right");
  //   }
  // }

  showSidebar() {
    const sidebar = d3.select("#map-app-sidebar");
    const initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    if (initiativeListSidebar) {
      const bounds = initiativeListSidebar.getBoundingClientRect();
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
          this.updateSidebarWidth(target.getBoundingClientRect(), bounds);
        },
        false
      )
        .classed("sea-sidebar-open", true);
    }
    if (!sidebar.classed("sea-sidebar-list-initiatives"))
      d3.select(".w3-btn").attr("title", this.labels?.hideDirectory ?? '');
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-left");

    this.changeSidebar(); // Refresh the content of the sidebar
    if (document.getElementById("dir-filter") && window.outerWidth >= 1080)
      document.getElementById("dir-filter")?.focus();
  }

  updateSidebarWidth(directoryBounds: DOMRect, initiativeListBounds: DOMRect) {
    const map = this.mapPresenterFactory.map;
    if (!map)
      throw new Error("No map created yet"); // Can't sensibly do this if the map isnt set yet
    const mapBox = map.getContainer().getBoundingClientRect();
    
    const sidebarWidth =
      directoryBounds.x - mapBox.width +
      directoryBounds.width +
        (initiativeListBounds.x - mapBox.width >
          0
          ? initiativeListBounds.width
          : 0);
    eventbus.publish({
      topic: "Map.setActiveArea",
      data: {
        offset: sidebarWidth
      }
    });

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
            const bounds = target.getBoundingClientRect();
            this.updateSidebarWidth(bounds, bounds);
            // More coercion seems to be required here
            (window as unknown as {_seaSidebarClosing: boolean})._seaSidebarClosing = true;
          }
        },
        false
      )
      .classed("sea-sidebar-open", false);
    d3.select(".w3-btn").attr("title", this.labels?.showDirectory ?? '');
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
    d3.select(".w3-btn").attr("title", this.labels?.hideDirectory ?? '');

    const initiativeListSidebar = d3.select("#sea-initiatives-list-sidebar");
    if (!initiativeListSidebar.empty() && !sidebarButton.empty())
      initiativeListSidebar.insert(() => sidebarButton.node(), // moves sidebarButton
                                   "#sea-initiatives-list-sidebar-content");

    const node = initiativeListSidebar.node()
    if (node instanceof HTMLElement) {
      sidebar
        .on(
          "transitionend",
          (event: TransitionEvent) => {
            const target = event.target as HTMLElement|undefined; // Seems to need coercion
            if (target?.className === "w3-btn") return;
            if (event.propertyName === "transform" && target) {
              const bounds = target.getBoundingClientRect();
              this.updateSidebarWidth(bounds, bounds);
            }
          },
          false
        )
        .classed("sea-sidebar-list-initiatives", true);
    }
  }
  
  hideInitiativeList() {
    const sidebar = d3.select("#map-app-sidebar");
    const sidebarButton = d3.select("#map-app-sidebar-button");
    sidebar.insert(() => sidebarButton.node(), // moves sidebarButton
                   "#sea-initiatives-list-sidebar");
    const initiativeListSidebar = d3.select("#sea-initiatives-list-sidebar").node();

    if (initiativeListSidebar instanceof HTMLElement) {
      sidebar.on(
        "transitionend",
        (event: TransitionEvent) => {
          const target = event.target as HTMLElement|undefined; // Seems to need coercion
          if (target?.className === "w3-btn") return;
          if (event.propertyName === "transform" && target) {
            // const initiativeListBounds = initiativeListSidebar.getBoundingClientRect();
            const bounds = target.getBoundingClientRect();
            this.updateSidebarWidth(bounds, initiativeListSidebar?.getBoundingClientRect());
          }
        },
        false
      )
        .classed("sea-sidebar-list-initiatives", false);
    }
    d3.select(".w3-btn").attr("title", this.labels?.hideDirectory ?? '');
  }  
}
