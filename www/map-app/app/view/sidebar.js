// Set up the various sidebars
define([
  "app/eventbus",
  "d3",
  "view/base",
  "presenter/sidebar",
  "view/sidebar/initiatives",
  "view/sidebar/about",
  "view/sidebar/directory",
  "view/sidebar/datasets"
], function(eventbus, d3, viewBase, presenter, initiatives, about, directory,datasets) {
  "use strict";

  // This deals with the view object that controls the sidebar
  // It is not itself a sidebar/view object, but contains objects of that type

  function SidebarView() {}
  // inherit from the standard view base object:
  var proto = Object.create(viewBase.base.prototype);

  proto.createOpenButton = function() {
    // d3 selection redefines this, so hang onto it here:
    var that = this;
    var selection = this.d3selectAndClear("#map-app-sidebar-button")
      .append("button")
      .attr("class", "w3-btn")
      .attr("title", "Show directory")
      .on("click", function() {
        that.showSidebar();
      })
      .append("i")
      .attr("class", "fa fa-angle-right");

  };

  proto.createButtonRow = function() {
    // d3 selection redefines this, so hang onto it here:
    var that = this;
    var selection = this.d3selectAndClear("#map-app-sidebar-header");

    // This is where the navigation buttons will go.
    // These are recreated when the sidebar is changed, e.g. from MainMenu to initiatives.
    selection.append("i").attr("id", "map-app-sidebar-history-navigation");

    // The sidebar has a button that causes the main menu to be dispayed
   

    selection
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto")
      .attr("title", "Show directory")
      .on("click", function() {
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

    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", "Show search")
      .on("click", function() {
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

    selection
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", "Show info")
      .on("click", function() {
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

    if(this.presenter.showingDatasets()){
      selection
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", "Show Datasets")
        .on("click", function() {
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


  };

  proto.createSidebars = function() {
    

    if(this.presenter.showingDatasets()){
      this.sidebar = {
        about: about.createSidebar(),
        initiatives: initiatives.createSidebar(),
        // mainMenu: mainMenu.createSidebar(),
        directory: directory.createSidebar(),
        datasets: datasets.createSidebar()
      };
    }else{
      this.sidebar = {
        about: about.createSidebar(),
        initiatives: initiatives.createSidebar(),
        // mainMenu: mainMenu.createSidebar(),
        directory: directory.createSidebar(),
      };
    }

  };

  proto.changeSidebar = function(name) {
    this.sidebar[name].refresh();
  };

  // proto.hideSidebarIfItTakesWholeScreen = function() {
  //   // @todo - improve this test -
  //   // it is not really testing the predicate suggested by the name iof the function.
  //   if (window.innerWidth <= 600) {
  //     d3.select("#map-app-sidebar").classed("sea-sidebar-open", false);
  //     d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-right");
  //   }
  // };

  proto.showSidebar = function() {
    var that = this;
    let sidebar = d3.select("#map-app-sidebar");
    let initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    sidebar
      .on(
        "transitionend",
        function() {
          if (event.target.className === "w3-btn") return;
          if (event.propertyName === "transform") {
            d3.select("#map-app-sidebar-button").on("click", function() {
              that.hideSidebar();
            });
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
      d3.select(".w3-btn").attr("title", "Hide directory");
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-left");

    //that.changeSidebar("directory");
    if(document.getElementById("dir-filter") && window.innerWidth >= 900)
      document.getElementById("dir-filter").focus();


    

  };

  // This should be split into three functions:
  // 1. Close the sidebar regardless of current view
  // 2. Close the Initiatives list
  // 3. Close the Initiative sidebar
  proto.hideSidebar = function() {
    const that = this;
    //that.hideInitiativeList();
    let sidebar = d3.select("#map-app-sidebar");

    sidebar
      .on(
        "transitionend",
        function() {
          if (event.target.className === "w3-btn") return;
          if (event.propertyName === "transform") {
            d3.select("#map-app-sidebar-button").on("click", function() {
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
    d3.select(".w3-btn").attr("title", "Show directory");
    d3.select("#map-app-sidebar i").attr("class", "fa fa-angle-right");

  };

  proto.hideInitiativeSidebar = function() {
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");

    if (initiativeSidebar.node().getBoundingClientRect().x === 0) {
      initiativeSidebar.classed("sea-initiative-sidebar-open", false);
    }
  };

  proto.showInitiativeList = function() {
    //if empty don't show
    const empty = d3.select("#sea-initiatives-list-sidebar-content").select("ul").empty();
    if (empty){
      return;
    }
    //else show it
    let sidebar = d3.select("#map-app-sidebar");
    let sidebarButton = document.getElementById("map-app-sidebar-button");
    d3.select(".w3-btn").attr("title", "Hide directory");

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
  };
  proto.hideInitiativeList = function() {
    let sidebar = d3.select("#map-app-sidebar");
    let sidebarButton = document.getElementById("map-app-sidebar-button");
    let initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    sidebar.node().insertBefore(sidebarButton, initiativeListSidebar);
    sidebar
      .on(
        "transitionend",
        function() {
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
    d3.select(".w3-btn").attr("title", "Hide directory");
    d3.select(".sea-field-active").classed("sea-field-active", false);

  };
  SidebarView.prototype = proto;
  var view;

  function init() {
    view = new SidebarView();
    view.setPresenter(presenter.createPresenter(view));
    view.createOpenButton();
    view.createButtonRow();
    view.createSidebars();
    view.changeSidebar("directory");
  }
  var pub = {
    init: init
    };
  return pub;
});
