"use strict";
const eventbus = require('../../eventbus');

function init(registry) {
  const config = registry('config');
  const sidebarView = registry('view/sidebar/base');
  const dataServices = registry('model/dataservices');
  const sidebarPresenter = registry('presenter/sidebar/base');
  const markerView = registry('view/map/marker');

  function StackItem(initiatives) {
    this.initiatives = initiatives;
  }
  StackItem.prototype.isSearchResults = function () {
    // TODO - surely there's a more direct way to decide if this is a SearchResults object?
    return this.hasOwnProperty("searchString");
  };

  function SearchResults(initiatives, searchString) {
    // isa StackItem
    StackItem.call(this, initiatives);
    this.searchString = searchString;
  }
  SearchResults.prototype = Object.create(StackItem.prototype);

  function Presenter() { }

  var proto = Object.create(sidebarPresenter.base.prototype);


  proto.currentItem = function () {
    return this.contentStack.current();
  };
  proto.currentItemExists = function () {
    // returns true only if the contentStack is empty
    return typeof this.contentStack.current() !== "undefined";
  };

  proto.getVerboseValuesForFields = function () {
    return dataServices.getVerboseValuesForFields();
  };

  proto.getRegisteredValues = function () {
    return dataServices.getAggregatedData().registeredValues;
  };

  proto.getAllRegisteredValues = function () {
    return dataServices.getAggregatedData().allRegisteredValues;
  };

  proto.notifyViewToBuildDirectory = function () {
    this.view.refresh();
  };

  // Gets the initiatives with a selection key, or if absent, gets all the initiatives
  proto.getInitiativesForFieldAndSelectionKey = function (field, key) {
    if (key == null)
      return dataServices.getAggregatedData().allRegisteredValues[field];
    else
      return dataServices.getAggregatedData().registeredValues[field][key];
  };

  proto.getInitiativeByUniqueId = function (uid) {
    return dataServices.getAggregatedData().initiativeByUniqueId[uid];
  };

  function arrayMax(array) {
    return array.reduce((a, b) => Math.max(a ?? Number.NEGATIVE_INFINITY, b ?? Number.NEGATIVE_INFINITY));
  }
  function arrayMin(array) {
    return array.reduce((a, b) => Math.min(a ?? Number.POSITIVE_INFINITY, b ?? Number.POSITIVE_INFINITY));
  }

  proto.doesDirectoryHaveColours = function () {
    return config.doesDirectoryHaveColours();
  };

  proto.notifyMapNeedsToNeedsToBeZoomedAndPanned = function (initiatives) {
    // eventbus.publish({
    //   topic: "Map.fitBounds",
    //   data: {
    //     bounds: boundsс,
    //     options: {
    //       maxZoom: 9
    //     }
    //   }
    // }); //should be doing this

    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);
    let options = { maxZoom: config.getMaxZoomOnGroup() };
    if (initiatives.length == 1)
      options = { maxZoom: config.getMaxZoomOnOne() };

    if (options.maxZoom == 0)
      options = {};

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          , options
        }
      });

      //rm for now as it isn't working well enough
    }
  };


  proto.notifyMapNeedsToNeedsToSelectInitiative = function (initiatives) {
    // eventbus.publish({
    //   topic: "Map.fitBounds",
    //   data: {
    //     bounds: boundsс,
    //     options: {
    //       maxZoom: 9
    //     }
    //   }
    // }); //should be doing this

    let options = { maxZoom: config.getMaxZoomOnGroup() };
    if (initiatives.length == 1)
      options = { maxZoom: config.getMaxZoomOnOne() };

    if (options.maxZoom == 0)
      options = {};

    const defaultPos = config.getDefaultLatLng();
    if (initiatives.length > 0) {
      const lats = initiatives.map(x => x.lat || defaultPos[0]);
      const lngs = initiatives.map(x => x.lng || defaultPos[1]);
      eventbus.publish({
        topic: "Map.selectAndZoomOnInitiative",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          , options
        }
      });
    }
  };

  proto.onInitiativeMouseoverInSidebar = function (initiative) {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  };
  proto.onInitiativeMouseoutInSidebar = function (initiative) {
    eventbus.publish({
      topic: "Map.needToHideInitiativeTooltip",
      data: initiative
    });
  };

  proto.clearLatestSelection = function () {
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });
  }

  proto.removeFilters = function (filterName = null) {
    //remove specific filter
    if (filterName) {
      eventbus.publish({
        topic: "Map.removeFilter",
        data: {
          filterName: filterName,
          noZoom: true
        }
      });
    } else {
      //remove all filters
      eventbus.publish({
        topic: "Map.removeFilters",
        data: {}
      });
    }
    this.view.d3selectAndClear(
      "#sea-initiatives-list-sidebar-content"
    );
    //clear the window
    eventbus.publish({
      topic: "Sidebar.hideInitiativeList"
    });
    this.clearLatestSelection();
    // const latlng = latLngBounds(null);
    // eventbus.publish({
    //   topic: "Map.needsToBeZoomedAndPanned",
    //   data: {
    //    initiatives: initiatives?,
    //     bounds: latlng,
    //     options: {
    //       maxZoom: 5
    //     }
    //   }
    // });
  }

  proto.initiativeClicked = function (initiative) {
    if (initiative) {
      //this.contentStack.append(new StackItem([initiative]));
      // Move the window to the right position first
      this.notifyMapNeedsToNeedsToSelectInitiative([initiative]);

      // Populate the sidebar and hoghlight the iitiative in the directory
      this.view.populateInitiativeSidebar(
        initiative,
        markerView.getInitiativeContent(initiative)
      );

    } else {
      // User has deselected
      // TODO: This probably shouldn\t be here
      eventbus.publish({
        topic: "Markers.needToShowLatestSelection",
        data: {
          selected: []
        }
      });
      // Deselect the sidebar and hoghlight the iitiative in the directory
      this.view.deselectInitiativeSidebar();

      //doesn't do much?
    }
  };

  function latLngBounds(initiatives) {
    return dataServices.latLngBounds(initiatives);
  }

  Presenter.prototype = proto;

  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);
    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: function (data) {
        // User has deselected
        // TODO: This probably shouldn\t be here
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        //todo reload new ones inside instead (without closing)
        eventbus.publish({
          topic: "Sidebar.hideInitiativeList"
        });
      }
    });
    // eventbus.subscribe({topic: "Marker.SelectionToggled", callback: function(data) { p.onMarkerSelectionToggled(data); } });
    // eventbus.subscribe({topic: "Marker.SelectionSet", callback: function(data) { p.onMarkerSelectionSet(data); } });
    eventbus.subscribe({
      topic: "Directory.InitiativeClicked",
      callback: function (data) {
        p.initiativeClicked(data);
      }
    });
    eventbus.subscribe({
      topic: "Directory.removeFilters",
      callback: function (data) {
        p.removeFilters(data);
      }
    });


    return p;
  }
  return {
    createPresenter: createPresenter,
    latLngBounds: latLngBounds
  };
}

module.exports = init;