define([
  "app/eventbus",
  "model/config",
  "model/sse_initiative",
  "presenter/sidebar/base",
  "presenter/map"
], function(eventbus, config, sseInitiative, sidebarPresenter,map) {
  "use strict";

  function StackItem(initiatives) {
    this.initiatives = initiatives;
  }
  StackItem.prototype.isSearchResults = function() {
    // TODO - surely there's a more direct way to decide if this is a SearchResults object?
    return this.hasOwnProperty("searchString");
  };

  function SearchResults(initiatives, searchString,filters=[]) {
    // isa StackItem
    StackItem.call(this, initiatives);
    this.searchedFor = searchString;
    this.searchString = filters.length > 0? 
    "\""+searchString + "\" in " + filters.join(", ")
    : "\""+searchString + "\"";
  }
  SearchResults.prototype = Object.create(StackItem.prototype);

  function Presenter() {}

  var proto = Object.create(sidebarPresenter.base.prototype);

  proto.currentItem = function() {
    return this.contentStack.current();
  };

  proto.currentItemExists = function() {
    // returns true only if the contentStack is empty
    return typeof (this.contentStack.current() !== "undefined" || this.contentStack.current() != null);
  };
  proto.notifyMarkersNeedToShowNewSelection = function(lastContent,newContent = null) {
    if(!newContent){
      newContent = this.contentStack.current().initiatives
    }
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: newContent
      }
    });
  };
  function arrayMax(array) {
    return array.reduce((a, b) => Math.max(a, b));
    
  }
  function arrayMin(array) {
    return array.reduce((a, b) => Math.min(a, b));
  }
  proto.notifyMapNeedsToNeedsToBeZoomedAndPanned = function(sidebarWidth) {
    const initiatives = this.contentStack.current().initiatives;
    sidebarWidth = sidebarWidth || 0;
    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ],
          options: {
            paddingTopLeft: [sidebarWidth, window.innerHeight / 2],
            paddingBottomRight: [0, 0]
          }
        }
      });
    }
  };

  proto.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative = function(initiative,sidebarWidth) {
    const initiatives = [initiative];
    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);
    sidebarWidth = sidebarWidth || 0;

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          // ,options: {
          //   paddingTopLeft: [sidebarWidth, window.innerHeight / 2],
          //   paddingBottomRight: [0, 0]
          //   //,maxZoom: 12
          // }
        }
      });
    }
  };


  proto.notifyShowInitiativeTooltip = function(initiative) {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  };
  proto.notifyHideInitiativeTooltip = function(initiative) {
    eventbus.publish({
      topic: "Map.needToHideInitiativeTooltip",
      data: initiative
    });
  };
  proto.notifySidebarNeedsToShowInitiatives = function() {
    eventbus.publish({ topic: "Sidebar.showInitiatives" });
  };
  proto.historyButtonsUsed = function(lastContent) {
    //console.log("sidebar/initiatives historyButtonsUsed");
    //console.log(lastContent);
    //this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view.refresh();
  };

  proto.onInitiativeResults = function(data) {
    // TODO - handle better when data.results is empty
    //        Prob don't want to put them on the stack?
    //        But still need to show the fact that there are no results.

    //get the uniquids of the applied filters
    const filterKeys = Object.keys(map.getFilteredMap());

    //go in if there are any filters
    if(filterKeys.length != 0){
      //get the intersection of the filtered content and the search data
      //search results should be a subset of filtered
      data.results = data.results.filter(i=> filterKeys.includes(i.uniqueId));
    }

    //filter
    const lastContent = this.contentStack.current();
    this.contentStack.append(new SearchResults(data.results, data.text,map.getFiltersVerbose()));

    if(data.results.length == 1){
      this.notifyMarkersNeedToShowNewSelection(lastContent,data.results);
      this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(data.results[0]);
    }
    else if (data.results.length == 0){
      //do nothing on failed search
      console.log("no results");
    }
    else{
      //this.notifyMarkersNeedToShowNewSelection(lastContent);
      //deselect all
      this.notifyMapNeedsToNeedsToBeZoomedAndPanned();
    }

    //highlight markers on search results 
    eventbus.publish({
      topic: "Map.addSearchFilter",
      data: {initiatives: data.results}
    });

    this.notifySidebarNeedsToShowInitiatives();
    this.view.refresh();
  };

  proto.initClicked= function(initiative){
    eventbus.publish({
      topic: "Directory.InitiativeClicked",
      data: initiative
    });
    if (window.innerWidth <= 800) {
      eventbus.publish({
        topic: "Directory.InitiativeClickedSidebar.hideSidebar",
        data: {initiative: initiative}
      });
    }
  };

  proto.onInitiativeClickedInSidebar = function(data) {
    console.log(data)

    const initiative = data.initiative;
    const lastContent = this.contentStack.current();
    //this.contentStack.append(new StackItem([initiative]));
    //console.log(this.contentStack.current());
    
    this.notifyMarkersNeedToShowNewSelection(lastContent,[initiative]);
    this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative);
    
    this.view.refresh();
    eventbus.publish({
      topic: "Initiatives.searchedInitiativeClicked",
      data: {initiative: data.initiative}
    });
  };
  proto.onInitiativeMouseoverInSidebar = function(initiative) {
    this.notifyShowInitiativeTooltip(initiative);
  };
  proto.onInitiativeMouseoutInSidebar = function(initiative) {
    this.notifyHideInitiativeTooltip(initiative);
  };
  proto.onMarkerSelectionSet = function(data) {
    const initiative = data;
    //console.log(initiative);
    const lastContent = this.contentStack.current();
    //this.contentStack.append(new StackItem([initiative]));
    this.notifyMarkersNeedToShowNewSelection(lastContent);
    // this.notifySidebarNeedsToShowInitiatives();
    this.view.refresh();
  };
  proto.onMarkerSelectionToggled = function(data) {
    const initiative = data;
    const lastContent = this.contentStack.current();
    // Make a clone of the current initiatives:
    const initiatives =
      typeof lastContent != "undefined" ? lastContent.initiatives.slice(0) : [];
    const index = initiatives.indexOf(initiative);
    if (index == -1) {
      initiatives.push(initiative);
    } else {
      // remove elment form array (sigh - is this really the best array method for this?)
      initiatives.splice(index, 1);
    }
    //this.contentStack.append(new StackItem(initiatives));
    this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view.refresh();
  };

  proto.onSearchHistory = function () {
    const that = this;
    this.contentStack.gotoEnd();
    eventbus.publish({
      topic: "Map.removeSearchFilter",
      data: {}
    });
    
  }

  proto.searchedInitiativeClicked = function (id) {
    this.view.onInitiativeClicked(id);
  }


  proto.performSearch = function(text) {
    console.log("Search submitted: [" + text + "]");
    // We need to make sure that the search sidebar is loaded
    if (text.length > 0) {
      eventbus.publish({
        topic: "Sidebar.hideInitiativeList"
      });
      eventbus.publish({
        topic: "Markers.needToShowLatestSelection",
        data: {
          selected: []
        }
      });

      //should be async
      var results = sseInitiative.search(text);
      eventbus.publish({
        topic: "Search.initiativeResults",
        data: { text: text, results: results }
      });
    }
    else {
      //TODO: do other stuff like panning
      //causes err?
      eventbus.publish({topic: "Map.removeSearchFilter"});
      eventbus.publish({topic: "Sidebar.showDirectory"});
    }
  };


  proto.changeSearchText = function(txt){
    this.view.changeSearchText(txt);
  };

  Presenter.prototype = proto;

  function createPresenter(view) {


    var p = new Presenter();
    p.registerView(view);
    eventbus.subscribe({
      topic: "Search.initiativeResults",
      callback: function(data) {
        p.onInitiativeResults(data);
      }
    });
    /*
    eventbus.subscribe({
      topic: "Datasets.filterDataset",
      callback: function(data) {
        //p.onInitiativeResults(data);
      }
    });
    */

    eventbus.subscribe({
      topic: "Marker.SelectionToggled",
      callback: function(data) {
        p.onMarkerSelectionToggled(data);
      }
    });
    eventbus.subscribe({
      topic: "Marker.SelectionSet",
      callback: function(data) {
        p.onMarkerSelectionSet(data);
      }
    });
    eventbus.subscribe({
      topic: "Directory.initiativeClicked",
      callback: function(data) {
        p.onInitiativeClickedInSidebar(data);
      }
    });

    eventbus.subscribe({
      topic: "Initiatives.showSearchHistory",
      callback: function(data){
        p.onSearchHistory()
      }
    });

    eventbus.subscribe({
      topic: "Initiatives.searchedInitiativeClicked",
      callback: function(data){
        p.searchedInitiativeClicked(data.initiative.uniqueId)
      }
    });

    eventbus.subscribe({
      topic: "Search.changeSearchText",
      callback: function(data){
        p.changeSearchText(data.txt)
      }
    });
    return p;
  }
  var pub = {
    createPresenter: createPresenter
  };
  return pub;
});
