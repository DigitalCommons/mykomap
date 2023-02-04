// The view aspects of the Main Menu sidebar
"use strict";
const { lab } = require('d3');
const d3 = require('d3');
const eventbus = require('../../eventbus')
const { DirectoryPresenter } = require('../../presenter/sidebar/directory');

function init(registry) {
  const config = registry('config');
  const view = registry('view/base');
  const sidebarView = registry('view/sidebar/base');
  const dataServices = registry('model/dataservices');
  const markerView = registry('view/map/marker');

  //get labels for buttons and titles
  const labels = dataServices.getFunctionalLabels();

  // Our local Sidebar object:
  function Sidebar() { }

  function uriToTag(uri) {
    return uri.toLowerCase().replace(/^.*[:\/]/, "");
  }
  function labelToTag(uri) {
    return uri.toLowerCase().replace(/ /g, "-");
  }

  // Our local Sidebar inherits from sidebar:
  var proto = Object.create(sidebarView.base.prototype);

  // And adds some overrides and new properties of it's own:
  proto.title = labels.directory;
  proto.hasHistoryNavigation = false;

  proto.populateFixedSelection = function (selection) {

    const that = this;
    let sidebarTitle = proto.title;
    const container = selection
      .append("div");

    container.append("h1")
      .text(sidebarTitle)
      .attr("id", "dir-title");

    container.append("input")
      .attr("id", "dir-filter")
      //.classed("w3-center",true)
      .attr("type", "text")
      .on("keyup", function () {
        that.handleFilter(this.value);
      });
  };

  var dissapear;

  proto.resetFilterSearch = function () {
    if (document.getElementById("dir-filter")) {
      document.getElementById("dir-filter").value = '';
      this.handleFilter('');
    }
  };

  proto.handleFilter = function (input) {
    if (this.dissapear) {
      clearTimeout(this.dissapear);
      this.dissapear = null;
    }

    if (!input || input == null)
      d3.selectAll("li.sea-directory-field").attr("hidden", null);
    else {
      const a = d3.selectAll("li.sea-directory-field");
      a.attr("hidden", null);
      a.filter(function (obj, i) {
        return !a._groups[0][i].innerHTML.toLowerCase().includes(input);
      }).attr("hidden", true);
      //appear and set dissapear after seconds
      //cancel last dissapear if new one is coming in
      d3.select("#dir-filter")
        .style("width", "auto")
        .style("opacity", "100");

      function dissapear() {
        d3.select("#dir-filter")
          .transition()
          .duration(400)
          .style("opacity", "0").transition().style("width", "0px");
      }

      // dissapear in 1 sec
      this.dissapear = window.setTimeout(dissapear, 1000);

    }

  }

  proto.populateScrollableSelection = function (selection) {
    let that = this;
    let list = selection
      .append("ul")
      .classed("sea-directory-list", true)
      .classed("colours", this.presenter.doesDirectoryHaveColours());

    // key may be null, for the special 'Every item' case
    function addItem(field, key) {
      let valuesByName = that.presenter.getVerboseValuesForFields()[field];
      let label = key;
      let tag = key;

      const fieldIsCountries = field => field == "Countries" || field == "Des Pays" || field == "Países" || field == "국가"

      if (key == null) {
        tag = 'all-entries';
        label = fieldIsCountries(field) ? labels.allCountries : labels.allEntries;
      }
      else {
        tag = uriToTag(key);
        if (valuesByName)
          label = valuesByName[key];
      }

      list
        .append("li")
        .text(label)
        .classed("sea-field-" + tag, true)
        .classed("sea-directory-field", true)
        .on("click", function () {
          eventbus.publish({
            topic: "Map.removeFilters",
            data: {}
          });
          that.listInitiativesForSelection(field, key); // key may be null
          that.resetFilterSearch();
          d3.select(".sea-field-active").classed("sea-field-active", false);
          d3.select(this).classed("sea-field-active", true);
        });
    }

    function addItems(field, values) {
      Object.keys(values)
        // Any sorting should have been done as the initiatives were loaded
        .forEach(key => {
          addItem(field, key);
        });
    }

    const registeredValues = this.presenter.getRegisteredValues();
    // Just run om the first property for now
    // TODO: Support user selectable fields
    for (let field in registeredValues) {
      // Deal with the special 'All' item first
      addItem(field);

      addItems(field, registeredValues[field]);
      break;
    }
  };


  // selectionKey may be null, for the special 'Every item' case
  proto.listInitiativesForSelection = function (directoryField, selectionKey) {
    let that = this;
    let initiatives = this.presenter.getInitiativesForFieldAndSelectionKey(
      directoryField,
      selectionKey
    );

    const fieldIsCountries = field => field == "Countries" || field == "Des Pays" || field == "Países" || field == "국가"

    const selectionLabel = selectionKey == null ? fieldIsCountries(directoryField) ? labels.allCountries : labels.allEntries : selectionKey;

    //deselect all
    that.presenter.clearLatestSelection();

    // if (window.outerWidth <= 800) {
    //   eventbus.publish({
    //     topic: "Directory.InitiativeClickedSidebar.hideSidebar"
    //   });
    // }

    that.presenter.notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives);

    let sidebar = d3.select("#map-app-sidebar");
    let sidebarButton = document.getElementById("map-app-sidebar-button");
    d3.select(".w3-btn").attr("title", labels.hideDirectory);
    let initiativeListSidebar = document.getElementById(
      "sea-initiatives-list-sidebar"
    );
    let selection = this.d3selectAndClear(
      "#sea-initiatives-list-sidebar-content"
    );
    let values = this.presenter.getVerboseValuesForFields()[directoryField];
    let list;
    initiativeListSidebar.insertBefore(sidebarButton, selection.node());
    initiativeListSidebar.className = initiativeListSidebar.className.replace(
      /sea-field-[^\s]*/,
      ""
    );
    initiativeListSidebar.classList.add(
      "sea-field-" + labelToTag(selectionLabel)
    );

    // Add the heading (we need to determine the title as this may be stored in the data or
    // in the list of values in the presenter)
    let title;
    if (values) {
      // If values exists and there's nothing in it for this selectionLabel then we're looking at All
      title = values[selectionLabel] || selectionLabel;
    } else {
      // If values doesn't exist then the values are coming from the data directly
      title = selectionLabel;
    }

    eventbus.publish({
      topic: "Map.addFilter",
      data: {
        initiatives: initiatives,
        filterName: selectionKey,
        verboseName: (directoryField + ": " + title)
      }
    });




    //setup sidebar buttons in initiative list
    const sidebarBtnHolder = selection.append("div").attr("class", "initiative-list-sidebar-btn-wrapper");


    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0 initiative-list-sidebar-btn")
      .attr("title", labels.showSearch)
      .on("click", function () {

        eventbus.publish({
          topic: "Sidebar.hideInitiativeList",
        });
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        eventbus.publish({
          topic: "Initiatives.showSearchHistory",
        });
        eventbus.publish({
          topic: "Sidebar.showInitiatives",
        });

      })
      .append("i")
      .attr("class", "fa fa-search");



    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", labels.showInfo)
      .on("click", function () {
        eventbus.publish({
          topic: "Sidebar.hideInitiativeList",
        });
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        // eventbus.publish({
        // topic: "Map.removeSearchFilter"});
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        eventbus.publish({
          topic: "Sidebar.showAbout",
        });
      })
      .append("i")
      .attr("class", "fa fa-info-circle");



    if (true) {
      sidebarBtnHolder
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", labels.showDatasets)
        .on("click", function () {
          eventbus.publish({
            topic: "Sidebar.hideInitiativeList",
          });
          eventbus.publish({
            topic: "Markers.needToShowLatestSelection",
            data: {
              selected: []
            }
          });
          eventbus.publish({
            topic: "Sidebar.showDatasets",
          });
          // // eventbus.publish({
          // //   topic: "Map.removeSearchFilter",
          // //   });

        })
        .append("i")
        .attr("class", "fa fa-database");
    }



    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button")
      .attr("title", labels.close + title)
      .on("click", function () {
        that.presenter.removeFilters(directoryField + selectionKey);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");



    selection
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button sidebar-normal-size-close-btn")
      .attr("title", labels.close + title)
      .on("click", function () {
        that.presenter.removeFilters(directoryField + selectionKey);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");

    selection
      .append("h2")
      .classed("sea-field", true)
      .text(title)
      .on("click", function () {
        // if (window.outerWidth <= 800) {
        //   eventbus.publish({
        //     topic: "Directory.InitiativeClickedSidebar.hideSidebar"
        //   });
        // }
        that.presenter.notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives);
      });
    list = selection.append("ul").classed("sea-initiative-list", true);
    for (let initiative of initiatives) {
      let activeClass = "";
      let nongeoClass = "";
      if (
        this.presenter.contentStack.current() &&
        this.presenter.contentStack.current().initiatives[0] === initiative
      ) {
        activeClass = "sea-initiative-active";
      }

      if (!initiative.hasLocation()) {
        nongeoClass = "sea-initiative-non-geo";
      }

      list
        .append("li")
        .text(initiative.name)
        .attr("data-uid", initiative.uri)
        .classed(activeClass, true)
        .classed(nongeoClass, true)
        .on("click", function () {
          eventbus.publish({
            topic: "Directory.InitiativeClicked",
            data: initiative
          });
        })
        .on("mouseover", function (e) {
          that.presenter.onInitiativeMouseoverInSidebar(initiative);
        })
        .on("mouseout", function (e) {
          that.presenter.onInitiativeMouseoutInSidebar(initiative);
        });


    }
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

  proto.populateInitiativeSidebar = function (initiative, initiativeContent) {
    // Highlight the correct initiative in the directory
    d3.select(".sea-initiative-active").classed("sea-initiative-active", false);
    d3.select('[data-uid="' + initiative.uri + '"]').classed(
      "sea-initiative-active",
      true
    );
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");
    let initiativeContentElement = this.d3selectAndClear(
      "#sea-initiative-sidebar-content"
    );
    initiativeContentElement
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button")
      .attr("title", labels.close + initiative.name)
      .on("click", function () {
        eventbus.publish({
          topic: "Directory.InitiativeClicked"
        });
      })
      .append("i")
      .attr("class", "fa " + "fa-times");
    initiativeContentElement
      .node()
      .appendChild(
        document.importNode(
          new DOMParser().parseFromString(
            "<div>" + initiativeContent + "</div>",
            "text/html"
          ).body.childNodes[0],
          true
        )
      );
    initiativeSidebar.classed("sea-initiative-sidebar-open", true);
    // if (document.getElementById("map-app-leaflet-map").clientWidth < 800)
    if (window.outerWidth < 800)
      eventbus.publish({
        topic: "Sidebar.showSidebar"
      });
  };

  proto.deselectInitiativeSidebar = function () {
    d3.select(".sea-initiative-active").classed("sea-initiative-active", false);
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");
    // let initiativeContentElement = d3.select("#sea-initiative-sidebar-content");
    // initiativeContentElement.html(initiativeContent);
    initiativeSidebar.classed("sea-initiative-sidebar-open", false);
    d3.select(".sea-search-initiative-active")
      .classed("sea-search-initiative-active", false);
  };

  Sidebar.prototype = proto;

  function createSidebar() {
    var view = new Sidebar();
    view.setPresenter(new DirectoryPresenter(view, config, dataServices, markerView));
    return view;
  }
  return {
    createSidebar: createSidebar
  };
}


module.exports = init;
