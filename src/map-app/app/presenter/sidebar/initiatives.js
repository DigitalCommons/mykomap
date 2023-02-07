"use strict";
const eventbus = require('../../eventbus');
const { BaseSidebarPresenter } = require('./base');


function arrayMax(array) {
  return array.reduce((a, b) => Math.max(a ?? Number.NEGATIVE_INFINITY, b ?? Number.NEGATIVE_INFINITY));
}

function arrayMin(array) {
  return array.reduce((a, b) => Math.min(a ?? Number.POSITIVE_INFINITY, b ?? Number.POSITIVE_INFINITY));
}


class StackItem {
  constructor(initiatives) {
    this.initiatives = initiatives;
  }
  
  isSearchResults() {
    // TODO - surely there's a more direct way to decide if this is a SearchResults object?
    return this.hasOwnProperty("searchString");
  }
}

class SearchResults extends StackItem {
  constructor(initiatives, searchString, filterVerboseNames, filterNames, labels) {
    super(initiatives);
    this.searchedFor = searchString;
    this.searchString = filterVerboseNames.length > 0 ?
      "\"" + searchString + `" ${labels.in} ` + filterVerboseNames.join(` ${labels.and} `)
      : "\"" + searchString + "\"";
    this.filters = filterNames.map((filterName, index) => ({
      filterName,
      verboseName: filterVerboseNames[index]
    }));
  }
}

export class InitiativesPresenter extends BaseSidebarPresenter {
  
  static _eventbusRegister(view, p) {

    p.registerView(view);
    
    eventbus.subscribe({
      topic: "Search.initiativeResults",
      callback: function (data) {
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
      callback: function (data) {
        p.onMarkerSelectionToggled(data);
      }
    });
    eventbus.subscribe({
      topic: "Marker.SelectionSet",
      callback: function (data) {
        p.onMarkerSelectionSet(data);
      }
    });
    eventbus.subscribe({
      topic: "Directory.initiativeClicked",
      callback: function (data) {
        p.onInitiativeClickedInSidebar(data);
      }
    });

    eventbus.subscribe({
      topic: "Initiatives.showSearchHistory",
      callback: function (data) {
        p.onSearchHistory()
      }
    });

    eventbus.subscribe({
      topic: "Initiatives.searchedInitiativeClicked",
      callback: function (data) {
        p.searchedInitiativeClicked(data.initiative.uri)
      }
    });

    eventbus.subscribe({
      topic: "Search.changeSearchText",
      callback: function (data) {
        p.changeSearchText(data.txt)
      }
    });
    return p;
  }

  
  constructor(view, labels, map) {
    super();
    this.parent = view.parent.presenter;
    // a lookup for labels of buttons and titles
    this.labels = labels;
    // a MapPresenterFactory
    this.map = map;
    InitiativesPresenter._eventbusRegister(view, this);
  }

  currentItem () {
    return this.parent.contentStack.current();
  }

  currentItemExists() {
    // returns true only if the contentStack is empty
    return typeof (this.parent.contentStack.current() !== "undefined" || this.parent.contentStack.current() != null);
  }
  
  notifyMarkersNeedToShowNewSelection(lastContent, newContent = null) {
    if (!newContent) {
      newContent = this.parent.contentStack.current().initiatives
    }
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: newContent
      }
    });
  }

  notifyMapNeedsToNeedsToBeZoomedAndPanned(sidebarWidth) {
    const initiatives = this.parent.contentStack.current().initiatives;
    sidebarWidth = sidebarWidth || 0;
    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: initiatives,
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
  }

  changeFilters(filterCategoryName, filterValue, filterValueText) {
    // Get the vocab URI from a map of vocab titles to abbreviated vocab URIs
    // FIXME if titles of vocabs match, this map will be incomplete!
    const vocabTitlesAndVocabIDs = dataServices.getVocabTitlesAndVocabIDs(); 
    const vocabID = vocabTitlesAndVocabIDs[filterCategoryName];
    
    // Get the category of filter (AKA the property ID used in intiatives)
    // from a map of abbreviated vocab URIs to property IDs
    // FIXME if more than one property uses a vocab, this map will be incomplete!
    const vocabIDsAndInitiativeVariables =
      dataServices.getAggregatedData().vocabFilteredFields;    
    const filterCategory = vocabIDsAndInitiativeVariables[vocabID];

    //remove old filter 
    const currentFilters = this.map.getFiltersFull();

    if (currentFilters.length > 0) {
      let oldFilter;

      currentFilters.forEach(filter => {
        if (filter.verboseName.split(":")[0] === filterCategoryName)
          oldFilter = filter;
      })

      if (oldFilter) {
        eventbus.publish({
          topic: "Map.removeFilter",
          data: oldFilter
        });
      }
    }

    //if filter is any, don't add a new filter
    if (filterValue === "any")
      return;

    //get initiatives for new filter
    const allInitiatives = Object.values(dataServices.getAggregatedData().initiativesByUid);
    const filteredInitiatives = allInitiatives.filter(initiative =>
      initiative[filterCategory] == filterValue
    )

    //create new filter
    let filterData = {
      filterName: filterValue,
      initiatives: filteredInitiatives,
      verboseName: filterCategoryName + ": " + filterValueText
    }

    eventbus.publish({
      topic: "Map.addFilter",
      data: filterData
    });

    eventbus.publish({
      topic: "Map.addSearchFilter",
      data: filterData
    });



  }

  removeFilters() {
    eventbus.publish(
      {
        topic: "Directory.removeFilters",
        data: null
      });
  }

  notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative, sidebarWidth) {
    const initiatives = [initiative];
    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);
    sidebarWidth = sidebarWidth || 0;

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.selectAndZoomOnInitiative",
        data: {
          initiatives: initiatives,
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
  }

  notifyShowInitiativeTooltip(initiative) {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  }

  notifyHideInitiativeTooltip(initiative) {
    eventbus.publish({
      topic: "Map.needToHideInitiativeTooltip",
      data: initiative
    });
  }

  notifySidebarNeedsToShowInitiatives() {
    eventbus.publish({ topic: "Sidebar.showInitiatives" });
  }
  
  historyButtonsUsed(lastContent) {
    //console.log("sidebar/initiatives historyButtonsUsed");
    //console.log(lastContent);
    //this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view.refresh();
  }

  onInitiativeResults(data) {
    // TODO - handle better when data.results is empty
    //        Prob don't want to put them on the stack?
    //        But still need to show the fact that there are no results.
    //get the uniquids of the applied filters
    const filterKeys = Object.keys(this.map.getFilteredMap());

    //go in if there are any filters
    if (filterKeys.length != 0) {
      //get the intersection of the filtered content and the search data
      //search results should be a subset of filtered

      data.results = data.results.filter(initiative =>
        filterKeys.includes(initiative.uri)
      );
    }

    //filter
    this.parent.contentStack.append(new SearchResults(data.results, data.text, this.map.getFiltersVerbose(), this.map.getFilters(), this.labels));

    //highlight markers on search results 
    //reveal all potentially hidden markers before zooming in on them 
    eventbus.publish({
      topic: "Map.addSearchFilter",
      data: { initiatives: data.results }
    });

    if (data.results.length == 1) {
      this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(data.results[0]);
    }
    else if (data.results.length == 0) {
      //do nothing on failed search
      console.log("no results");
    }
    else {
      //this.notifyMarkersNeedToShowNewSelection(lastContent);
      //deselect all
      this.notifyMapNeedsToNeedsToBeZoomedAndPanned(); //does not do anything?
    }

    this.notifySidebarNeedsToShowInitiatives();
    this.view.refresh();
  }

  getFilterNames() {
    return this.map.getFiltersVerbose();
  }

  initClicked(initiative) {
    eventbus.publish({
      topic: "Directory.InitiativeClicked",
      data: initiative
    });
    if (window.outerWidth <= 800) {
      eventbus.publish({
        topic: "Directory.InitiativeClickedSidebar.hideSidebar",
        data: { initiative: initiative }
      });
    }
  }

  onInitiativeClickedInSidebar(data) {
    console.log(data)

    const initiative = data.initiative;
    //this.parent.contentStack.append(new StackItem([initiative]));
    //console.log(this.parent.contentStack.current());

    this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative);
    this.view.refresh();
    eventbus.publish({
      topic: "Initiatives.searchedInitiativeClicked",
      data: { initiative: data.initiative }
    });
  }
  
  onInitiativeMouseoverInSidebar(initiative) {
    this.notifyShowInitiativeTooltip(initiative);
  }

  onInitiativeMouseoutInSidebar(initiative) {
    this.notifyHideInitiativeTooltip(initiative);
  }
  
  onMarkerSelectionSet(data) {
    const initiative = data;
    //console.log(initiative);
    const lastContent = this.parent.contentStack.current();
    //this.parent.contentStack.append(new StackItem([initiative]));
    this.notifyMarkersNeedToShowNewSelection(lastContent);
    // this.notifySidebarNeedsToShowInitiatives();
    this.view.refresh();
  }

  onMarkerSelectionToggled(data) {
    const initiative = data;
    const lastContent = this.parent.contentStack.current();
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
  }

  onSearchHistory() {
    const that = this;
    this.parent.contentStack.gotoEnd();
    eventbus.publish({
      topic: "Map.removeSearchFilter",
      data: {}
    });

  }

  searchedInitiativeClicked(id) {
    this.view.onInitiativeClicked(id);
  }

  performSearch(text) {
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
      var results = dataServices.getAggregatedData().search(text);
      eventbus.publish({
        topic: "Search.initiativeResults",
        data: { text: text, results: results }
      });
    }

    else {
      this.performSearchNoText();
    }
  }

  performSearchNoText() {
    console.log("perform search no text")

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
    var results = Object.values(dataServices.getAggregatedData().initiativesByUid);

    eventbus.publish({
      topic: "Search.initiativeResults",
      data: {
        text: "",
        results: results
      }
    });
  }

  changeSearchText(txt) {
    this.view.changeSearchText(txt);
  }
}
