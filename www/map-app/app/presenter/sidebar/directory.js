define([
  "app/eventbus",
  "model/config",
  "model/sse_initiative",
  "view/sidebar/base",
  "presenter/sidebar/base",
  "view/map/marker"
], function(
  eventbus,
  config,
  sseInitiative,
  sidebarView,
  sidebarPresenter,
  markerView
) {
  "use strict";

  function StackItem(initiatives) {
    this.initiatives = initiatives;
  }
  StackItem.prototype.isSearchResults = function() {
    // TODO - surely there's a more direct way to decide if this is a SearchResults object?
    return this.hasOwnProperty("searchString");
  };

  function SearchResults(initiatives, searchString) {
  	// isa StackItem
  	StackItem.call(this, initiatives);
  	this.searchString = searchString;
  }
  SearchResults.prototype = Object.create(StackItem.prototype);

  function Presenter() {}

  var proto = Object.create(sidebarPresenter.base.prototype);

  // TODO: We should get these values from the vocab, from config or from the source data
  const values = {
    Activities: {
      ALL: "All Activities",
      AM10: "Arts, Media, Culture & Leisure",
      AM20: "Campaigning, Activism & Advocacy",
      AM30: "Community & Collective Spaces",
      AM40: "Education",
      AM50: "Energy",
      AM60: "Food",
      AM70: "Goods & Services",
      AM80: "Health, Social Care & Wellbeing",
      AM90: "Housing",
      AM100: "Money & Finance",
      AM110: "Nature, Conservation & Environment",
      AM120: "Reduce, Reuse, Repair & Recycle"
    }
  };

  proto.currentItem = function() {
    return this.contentStack.current();
  };
  proto.currentItemExists = function() {
    // returns true only if the contentStack is empty
    return typeof this.contentStack.current() !== "undefined";
  };

  proto.getAllValuesByName = function(name) {
    return values[name];
  };

  proto.getRegisteredValues = function() {
    return sseInitiative.getRegisteredValues();
  };

  proto.notifyViewToBuildDirectory = function() {
    this.view.refresh();
  };

  proto.getInitiativesForFieldAndSelectionKey = function(field, key) {
    return sseInitiative.getRegisteredValues()[field][key];
  };

  proto.getInitiativeByUniqueId = function(uid) {
    return sseInitiative.getInitiativeByUniqueId(uid);
  };

  function arrayMax(array) {
    return array.reduce((a, b) => Math.max(a, b));
  }
  function arrayMin(array) {
    return array.reduce((a, b) => Math.min(a, b));
  }

  proto.doesDirectoryHaveColours = function() {
    return config.doesDirectoryHaveColours();
  };

  proto.notifyMapNeedsToNeedsToBeZoomedAndPanned = function(initiatives) {
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
    let options = {maxZoom: config.getMaxZoomOnGroup()};
    if (initiatives.length == 1)
      options = {maxZoom: config.getMaxZoomOnOne()};
    
    if(options.maxZoom == 0)
      options = {};
    
    console.log(initiatives);
    

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          ,options
        }
      });
      
      //rm for now as it isn't working well enough
    }
  };


  proto.notifyMapNeedsToNeedsToSelectInitiative = function(initiatives) {
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
    let options = {maxZoom: config.getMaxZoomOnGroup()};
    if (initiatives.length == 1)
      options = {maxZoom: config.getMaxZoomOnOne()};
    
    if(options.maxZoom == 0)
      options = {};
    
    console.log(options);
    

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.selectAndZoomOnInitiative",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          ,options
        }
      });
    }
  };

  proto.onInitiativeMouseoverInSidebar = function(initiative) {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  };
  proto.onInitiativeMouseoutInSidebar = function(initiative) {
    eventbus.publish({
      topic: "Map.needToHideInitiativeTooltip",
      data: initiative
    });
  };

  proto.clearLatestSelection = function() {
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });
  }

  proto.initiativeClicked = function(initiative) {
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
    return sseInitiative.latLngBounds(initiatives);
  }

  Presenter.prototype = proto;

  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);
    // Populate the directory with the registered activities
    eventbus.subscribe({
      topic: "Initiative.complete",
      callback: function(data) {
        p.notifyViewToBuildDirectory();
      }
    });
    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: function(data) {
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
      callback: function(data) {
        p.initiativeClicked(data);
      }
    });

    return p;
  }
  var pub = {
    createPresenter: createPresenter,
    latLngBounds: latLngBounds
  };
  return pub;
});
