// Set up the various sidebars
"use strict";
const eventbus = require('../eventbus');
const d3 = require('d3');
const { SidebarPresenter } = require('../presenter/sidebar');
const { AboutSidebarView } = require('../view/sidebar/about');
const { BaseView } = require('./base');
const { DatasetsSidebarView } = require('./sidebar/datasets');
const { DirectorySidebarView } = require('./sidebar/directory');
const { InitiativesSidebarView } = require('./sidebar/initiatives');

export class SidebarView extends BaseView {
  constructor(labels, config, dataServices, markerView, mapPresenterFactory, sidebarButtonColour) {
    super();
    this.labels = labels;
    this.config = config;
    this.dataServices = dataServices;
    this.markerView = markerView;
    this.mapPresenterFactory = mapPresenterFactory;
    this.sidebarButtonColour = sidebarButtonColour;

    const presenter = new SidebarPresenter(
      this,
      this.config.getShowDirectoryPanel(),
      this.config.getShowSearchPanel(),
      this.config.getShowAboutPanel(),
      this.config.getShowDatasetsPanel()
    );
    
    this.setPresenter(presenter);
    this.createOpenButton();
    this.createButtonRow();
    this.createSidebars();
    this.changeSidebar(); // Use the default
  }

  createOpenButton() {
    // d3 selection redefines this, so hang onto it here:
    var that = this;
    var selection = this.d3selectAndClear("#map-app-sidebar-button")
                        .append("button")
                        .attr("class", "w3-btn")
                        .attr("style","background-color: " + this.sidebarButtonColour)
                        .attr("title", this.labels.showDirectory)
                        .on("click", function () {
                          that.showSidebar();
                        })
                        .append("i")
                        .attr("class", "fa fa-angle-right");
  }

  createButtonRow() {
    // d3 selection redefines this, so hang onto it here:
    var that = this;
    var selection = this.d3selectAndClear("#map-app-sidebar-header");

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
      .attr("title", this.labels.showDirectory)
      .on("click", function () {
        eventbus.publish({
          topic: "Map.removeSearchFilter",
          data: {}
        });
        //notify zoom
        that.changeSidebar("directory");
        that.showInitiativeList();

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
      .attr("title", this.labels.showSearch)
      .on("click", function () {
        that.hideInitiativeList();
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
        that.changeSidebar("initiatives");
      })
      .append("i")
      .attr("class", "fa fa-search");
    }

    if (this.presenter.showingAbout()) {
    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", this.labels.showInfo)
      .on("click", function () {
        that.hideInitiativeList();
        // eventbus.publish({
        // topic: "Map.removeSearchFilter"});
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        that.changeSidebar("about");
      })
      .append("i")
      .attr("class", "fa fa-info-circle");
    }

    if (this.presenter.showingDatasets()) {
      selection
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", this.labels.showDatasets)
        .on("click", function () {
          that.hideInitiativeList();
          // eventbus.publish({
          //   topic: "Map.removeSearchFilter",
          //   });
          eventbus.publish({
            topic: "Markers.needToShowLatestSelection",
            data: {
              selected: []
            }
          });
          that.changeSidebar("datasets");
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
  changeSidebar(name) {
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
    this.sidebar[this.sidebarName].refresh();
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
    var that = this;
    let sidebar = d3.select("#map-app-sidebar");
    let initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    sidebar
      .on(
        "transitionend",
        function () {
          if (event.target.className === "w3-btn") return;
          if (event.propertyName === "transform") {
            d3.select("#map-app-sidebar-button").on("click", function () {
              that.hideSidebar();
            });
            //select input textbox if possible 
            if (document.getElementById("search-box") != null) document.getElementById("search-box").focus();

            eventbus.publish({
              topic: "Sidebar.updateSidebarWidth",
              data: {
                target: event.target,
                // sidebarWidth: this.clientWidth
                directoryBounds: this.getBoundingClientRect(),
                initiativeListBounds: initiativeListSidebar.getBoundingClientRect()
              }
            });
          }
        },
        false
      )
      .classed("sea-sidebar-open", true);
    if (!sidebar.classed("sea-sidebar-list-initiatives"))
      d3.select(".w3-btn").attr("title", this.labels.hideDirectory);
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-left");

    that.changeSidebar(); // Refresh the content of the sidebar
    if (document.getElementById("dir-filter") && window.outerWidth >= 1080)
      document.getElementById("dir-filter").focus();



  }

  // This should be split into three functions:
  // 1. Close the sidebar regardless of current view
  // 2. Close the Initiatives list
  // 3. Close the Initiative sidebar
  hideSidebar() {
    const that = this;
    //that.hideInitiativeList();
    let sidebar = d3.select("#map-app-sidebar");

    sidebar
      .on(
        "transitionend",
        function () {
          if (event.target.className === "w3-btn") return;
          if (event.propertyName === "transform") {
            d3.select("#map-app-sidebar-button").on("click", function () {
              that.showSidebar();
            });
            eventbus.publish({
              topic: "Sidebar.updateSidebarWidth",
              data: {
                target: event.target,
                directoryBounds: this.getBoundingClientRect(),
                initiativeListBounds: this.getBoundingClientRect()
              }
            });
            window._seaSidebarClosing = true;
          }
        },
        false
      )
      .classed("sea-sidebar-open", false);
    d3.select(".w3-btn").attr("title", this.labels.showDirectory);
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-right");

  }

  hideInitiativeSidebar() {
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");

    if (initiativeSidebar.node().getBoundingClientRect().x === 0) {
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
    let sidebar = d3.select("#map-app-sidebar");
    let sidebarButton = document.getElementById("map-app-sidebar-button");
    d3.select(".w3-btn").attr("title", this.labels.hideDirectory);

    let initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    let selection = d3.select(
      "#sea-initiatives-list-sidebar-content"
    );
    initiativeListSidebar.insertBefore(sidebarButton, selection.node());

    sidebar
      .on(
        "transitionend",
        function () {
          if (event.target.className === "w3-btn") return;
          if (event.propertyName === "transform") {
            eventbus.publish({
              topic: "Sidebar.updateSidebarWidth",
              data: {
                target: event.target,
                directoryBounds: this.getBoundingClientRect(),
                initiativeListBounds: initiativeListSidebar.getBoundingClientRect()
              }
            });
          }
        },
        false
      )
      .classed("sea-sidebar-list-initiatives", true);
  }
  hideInitiativeList() {
    let sidebar = d3.select("#map-app-sidebar");
    let sidebarButton = document.getElementById("map-app-sidebar-button");
    let initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    sidebar.node().insertBefore(sidebarButton, initiativeListSidebar);
    sidebar
      .on(
        "transitionend",
        function () {
          if (event.target.className === "w3-btn") return;
          if (event.propertyName === "transform") {
            // let initiativeListBounds = initiativeListSidebar.getBoundingClientRect();
            eventbus.publish({
              topic: "Sidebar.updateSidebarWidth",
              data: {
                target: event.target,
                // sidebarWidth:
                //   initiativeListBounds.width + this.getBoundingClientRect().width
                directoryBounds: this.getBoundingClientRect(),
                initiativeListBounds: initiativeListSidebar.getBoundingClientRect()
              }
            });
          }
        },
        false
      )
      .classed("sea-sidebar-list-initiatives", false);
    d3.select(".w3-btn").attr("title", this.labels.hideDirectory);
  }  
}
