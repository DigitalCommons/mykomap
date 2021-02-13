define([
  "app/eventbus",
  "model/sse_initiative",
  "presenter",
  "model/config",
  "view/map/marker"
], function (eventbus, sse_initiative, presenter, config, markerView) {
  "use strict";

  function Presenter() { }

  var proto = Object.create(presenter.base.prototype);

  let allMarkers = [];

  proto.getContextmenuItems = function () {
    // The context menu has been disabled (in www/app/view/map.js), in accordance with
    // https://github.com/SolidarityEconomyAssociation/open-data-and-maps/issues/78
    // So, don't expect this to do anything!
    return [
      {
        text: "Placehoder 1 - does nothing",
        callback: function (e) {
          console.log("Context menu item 1 selected.");
          console.log(e);
        }
      },
      {
        text: "Placehoder 2 - does nothing",
        callback: function (e) {
          console.log("Context menu item 2 selected.");
          console.log(e);
        }
      },
      {
        text: "Launch Google maps",
        callback: function (e) {
          // Documentation of Google maps URL parameters from here:
          // https://moz.com/ugc/everything-you-never-wanted-to-know-about-google-maps-parameters
          // Example:
          // https://www.google.co.uk/maps?q=loc:49.8764953,1.1566544&z=14&t=p

          var params = [
            // TODO - put a marker on Google maps at e.latlng.
            //"q=loc:" puts a marker on the map, BUT ignores the z and t parameters. Hmmm.
            //"q=loc:" + e.latlng.lat.toFixed(7) + "," + e.latlng.lng.toFixed(7),
            "ll=" + e.latlng.lat.toFixed(7) + "," + e.latlng.lng.toFixed(7),
            "z=14", // zoom. TODO: Consider matching with current view?
            "t=p" // for terrain map
          ];
          var url = "https://www.google.co.uk/maps?" + params.join("&");

          // This version of the URL also works (and is more modern?).
          // But I have not worked out how to specify a terrain map, nor markers.
          //var zoom = 14;
          //var url = "https://www.google.co.uk/maps/@" + e.latlng.lat.toFixed(7) + "," + e.latlng.lng.toFixed(7) + "," + zoom + "z";
          console.log(url);
          window.open(url, "_blank");
        }
      }
    ];
  };
  var copyTextToClipboard = function (text) {
    var textArea = document.createElement("textarea");
    // ***taken from https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript?page=1&tab=votes#tab-top ***
    //
    // *** This styling is an extra step which is likely not required. ***
    //
    // Why is it here? To ensure:
    // 1. the element is able to have focus and selection.
    // 2. if element was to flash render it has minimal visual impact.
    // 3. less flakyness with selection and copying which **might** occur if
    //    the textarea element is not visible.
    //
    // The likelihood is the element won't even render, not even a
    // flash, so some of these are just precautions. However in
    // Internet Explorer the element is visible whilst the popup
    // box asking the user for permission for the web page to
    // copy to the clipboard.
    //

    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as this gives a negative w/h on some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';


    textArea.value = text;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      var successful = document.execCommand('copy');
      console.log('Copying text: ' + text);
    } catch (err) {
      console.log('Oops, unable to copy');
    }

    document.body.removeChild(textArea);
  }
  proto.getTileUrl = function () {
    return config.getTileUrl();
  }
  proto.getMapAttribution = function() {
    return config.getMapAttribution();
  }
  proto.getMapEventHandlers = function () {
    return {
      click: function (e) {
        // Deselect any selected markers
        // this.marker.on("popupclose", e => {
        // console.log("Unselecting");
        if (e.originalEvent.ctrlKey) {
          copyTextToClipboard(e.latlng.lat + "," + e.latlng.lng);
        }

        eventbus.publish({
          topic: "Directory.InitiativeClicked",
          data: ""
        });
        // });
      },
      load: function (e) {
        console.log("Map loaded");
      },
      resize: function (e) {
        window.seaMap.invalidateSize();
        console.log("Map resize", window.outerWidth);
      }
    };
  };
  proto.onInitiativeNew = function (data) {
    const initiative = data,
      marker = this.view.addMarker(initiative).marker;

    if (marker.hasPhysicalLocation) allMarkers.push(marker);
  };
  proto.refreshInitiative = function (data) {
    const initiative = data;
    this.view.refreshMarker(initiative);
  };


  proto.onInitiativeReset = function (data) {

    this.view.removeAllMarkers();
    allMarkers = [];
    console.log("removing all");
    //rm markers 
  };

  proto.onInitiativeComplete = function () {
    // Load the markers into the clustergroup
    this.view.fitBounds(this.getInitialBounds());
    this.view.unselectedClusterGroup.addLayers(allMarkers);
    console.log("onInitiativeComplete");
    // eventbus.publish({
    //   topic: "Markers.completed",
    //   data: { markers: allMarkers }
    // });
    // eventbus.publish({
    //   topic: "Markers.",
    //   data: ""
    // });
  };


  proto.onInitiativeDatasetLoaded = function (data) {
    console.log("onInitiativeDatasetLoaded");
    //console.log(data);
    //console.log(data.latLngBounds());
    // this.view.fitBounds([[-45.87859, -162.60022], [76.47861, 176.84446]]);
  };
  proto.onInitiativeLoadComplete = function () {
    /* The protecting veil is now obsolete. */
    //view.clearProtectingVeil();
    // TODO - hook this up to a log?
    this.view.stopLoading();

  };
  proto.onInitiativeLoadMessage = function (data) {
    /* The protecting veil is now obsolete. */
    //view.showProtectingVeil(data.message);
    // TODO - hook this up to a log?
    this.view.startLoading(data);

  };

  let previouslySelected = [];
  //this will manage markers pop-ing up and zooming
  proto.onMarkersNeedToShowLatestSelection = function (data) {
    console.log(data)
    const that = this;
    previouslySelected.forEach(function (e) {
      that.view.setUnselected(e);
    });

    previouslySelected = data.selected;

    //zoom in and then select 
    data.selected.forEach(function (e) {
      that.view.setSelected(e);
    });
  };


  proto.onNeedToShowInitiativeTooltip = function (data) {
    this.view.showTooltip(data);
  };
  proto.onNeedToHideInitiativeTooltip = function (data) {
    this.view.hideTooltip(data);
  };
  //	proto.onInitiativeSelected = function(data) {
  //		const initiative = data;
  //		console.log('onInitiativeSelected');
  //		console.log(initiative);
  //		this.view.setSelected(initiative);
  //		this.view.zoomAndPanTo({lon: initiative.lng, lat: initiative.lat});
  //	};
  proto.onMapNeedsToBeZoomedAndPanned = function (data) {
    console.log("onMapNeedsToBeZoomedAndPanned ", data);
    const latLngBounds = data;
    this.view.flyToBounds(latLngBounds);
    // this.view.flyTo(data);
    // this.view.setView(data);
  };

  proto.onBoundsRequested = function (data) {
    this.view.fitBounds(data);
  };

  proto.setZoom = function (data) {
    console.log("Zooming to ", data);
    const zoom = data;
    this.view.setZoom(zoom);
  };

  proto.getInitialBounds = function () {
    return config.getInitialBounds() == undefined ?
      sse_initiative.latLngBounds(null) : config.getInitialBounds();
  };

  proto.getInitialZoom = function () { };

  proto.setActiveArea = function (data) {
    this.view.setActiveArea(data);
  };

  proto.getDisableClusteringAtZoomFromConfig = function () {
    return config.getDisableClusteringAtZoom() || false;
  };



  //FILTERS
  let filtered = {};
  let filteredInitiativesUIDMap = {};
  let verboseNamesMap = {};
  let initiativesOutsideOfFilterUIDMap = Object.assign({}, sse_initiative.getInitiativeUIDMap());
  let loadedInitiatives = sse_initiative.getLoadedInitiatives();
  proto.applyFilter = function () {
    //if there are currently any filters 
    if (getFiltered().length > 0) {
      //display only filtered initiatives, the rest should be hidden
      markerView.hideMarkers(this.getInitiativesOutsideOfFilter());
      markerView.showMarkers(getFiltered());
    } else //if no filters available show everything
      this.removeFilters();

  };


  proto.addFilter = function (data) {
    console.log("adding filter, filter data:");
    console.log(data);

    let initiatives = data.initiatives;
    let filterName = data.filterName;
    let verboseName = data.verboseName;

    //if filter already exists don't do anything
    if (Object.keys(filtered).includes(filterName))
      return;

    //add filter
    filtered[filterName] = initiatives;

    //add the verbose name of the filter
    verboseNamesMap[filterName] = verboseName;

    //if this is the first filter, add items to the filteredInitiativesUIDMap
    if(Object.keys(filtered).length <= 1){
      initiativesOutsideOfFilterUIDMap = Object.assign({},sse_initiative.getInitiativeUIDMap());
      //add to array only new unique entries
      initiatives.forEach(initiative => {
        //rm entry from outside map
        delete initiativesOutsideOfFilterUIDMap[initiative.uniqueId];
        filteredInitiativesUIDMap[initiative.uniqueId] = initiative;
      });
    }
    /* if this is the second or more filter, remove items from the 
    filteredInitiativesUIDMap if they don't appear in the new filter's set of initiatives
    */
    else{      
      for(const initiativeUniqueId in filteredInitiativesUIDMap){
        if(!initiatives.includes(filteredInitiativesUIDMap[initiativeUniqueId])){
          initiativesOutsideOfFilterUIDMap[initiativeUniqueId] = Object.assign({},filteredInitiativesUIDMap[initiativeUniqueId]);
          delete filteredInitiativesUIDMap[initiativeUniqueId];
        }
      }
    }

    console.log(filteredInitiativesUIDMap);

    //apply filters
    this.applyFilter();
  };



  proto.removeFilters = function () {
    //remove filters
    filtered = {};
    filteredInitiativesUIDMap = {};
    initiativesOutsideOfFilterUIDMap = Object.assign({}, sse_initiative.getInitiativeUIDMap());
    verboseNamesMap = {};
    //show all markers
    markerView.showMarkers(loadedInitiatives);
  };



  proto.removeFilter = function (data) {
    const filterName = data.filterName;
    //if filter doesn't exist don't do anything
    if (!Object.keys(filtered).includes(filterName))
      return;

    //remove the filter
    let oldFilterVals = filtered[filterName];
    delete filtered[filterName];

    //if no filters left call remove all and stop
    if (Object.keys(filtered).length <= 0) {
      this.removeFilters();
      return;
    }

    //add in the values that you are removing 
    oldFilterVals.forEach(i => {
      initiativesOutsideOfFilterUIDMap[i.uniqueId] = i;
    });

    //remove filter initatitives 
    //TODO: CAN YOU OPTIMISE THIS ? (currently running at o(n) )
    Object.keys(filtered).forEach(k => {
      filtered[k].forEach(i => {
        //add in unique ones
        filteredInitiativesUIDMap[i.uniqueId] = i;
        //remove the ones you added
        delete initiativesOutsideOfFilterUIDMap[i.uniqueId];
      })
    });

    //remove filter from verbose name
    delete verboseNamesMap[filterName];


    //apply filters
    this.applyFilter();
  };



  //should return an array of unique initiatives in filters
  function getFiltered() {
    return Object.values(filteredInitiativesUIDMap);
  };

  function getFilteredMap() {
    return filteredInitiativesUIDMap;
  }

  function getFilters(){
    return Object.keys(filtered);
  }

  function getFiltersFull(){
    let filterArray = []
    
    for(let filterName in verboseNamesMap){
      filterArray.push({
        "filterName": filterName,
        "verboseName": verboseNamesMap[filterName]
      })
    }

    return filterArray;
  }

  function getFiltersVerbose() {
    return Object.values(verboseNamesMap);
  }

  //should return an array of unique initiatives outside of filters
  proto.getInitiativesOutsideOfFilter = function () {
    return Object.values(initiativesOutsideOfFilterUIDMap);
  };
  //FILTERS END


  //SEARCH HIGHLIGHT


  //highlights markers, hides markers not in the current selection

  let hidden = [];
  let lastRequest = [];
  proto.addSearchFilter = function (data) {
    
    //if no results remove the filter, currently commented out
    if (data.initiatives != null && data.initiatives.length == 0) {
      // uncommenting this will reveal all initiatives on a failed search
      // this.removeSearchFilter();
      // return;
      console.log("no results, hide everything");
      //hide all 
      hidden = loadedInitiatives;
      markerView.hideMarkers(hidden);
      return;
    }

    //if the results match the previous results don't do anything
    if (data.initiatives == lastRequest)
      return;

    lastRequest = data.initiatives; //cache the last request

    //get the ids from the passed data
    const initiativeIds = data.initiatives.map(i => i.uniqueId);
    
    //hide the ones you need to  hide, i.e. difference between ALL and initiativesMap
    hidden = loadedInitiatives.filter(i => 
        !initiativeIds.includes(i.uniqueId)
    );

    //hide all unneeded markers
    markerView.hideMarkers(hidden);
    //make sure the markers you need to highlight are shown
    markerView.showMarkers(data.initiatives);

    //zoom and pan

    if (data.initiatives.length > 0) {
      var options = {
        maxZoom: config.getMaxZoomOnSearch()
      }
      if (options.maxZoom == 0)
        options = {};

      const latlng = sse_initiative.latLngBounds(data.initiatives)
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: data.initiatives,
          bounds: latlng,
          options: options
        }
      });
    }
  };

  proto.getLogo = function () {
    return config.logo();
  };

  proto.refresh = function () {
    eventbus.publish({
      topic: "Map.refresh",
      data: ""
    });
  }

  proto.selectAndZoomOnInitiative = function (data) {
    this.view.selectAndZoomOnInitiative(data);
  }


  //this can get called multiple times make sure it doesn't crash
  proto.removeSearchFilter = function () {

    //if no search filter to remove just return
    if (hidden.length === 0)
      return;

    //show hidden markers
    //markerView.showMarkers(hidden);
    this.applyFilter();

    if (getFiltered().length > 0) {
      //hide the initiatives that were outside of the filter
      markerView.hideMarkers(this.getInitiativesOutsideOfFilter());// this can be sped up
      //you can speed up the above statement by replacing this.getInitiativesOutsideOfFilter() 
      //with the difference between getFiltered() and data.initiatives
      //i.e. getting the initiatives that are outside of the filter but still shown

      //show the ones inside the filter that you just hid
      markerView.showMarkers(hidden);
    } else //if no filters available then the search was under global (only hidden ones need to be shown)
      markerView.showMarkers(hidden);

    //clear last request so you can search the same data again
    lastRequest = [];

    //reset the hidden array
    hidden = [];

    //zoom and pan
    //const latlng = sse_initiative.latLngBounds(getFiltered().length > 0? getFiltered() : null)
    // eventbus.publish({
    //   topic: "Map.needsToBeZoomedAndPanned",
    //   data: {
    //   initiatives: hidden,
    //     bounds: latlng,
    //     options: {
    //       maxZoom: config.getMaxZoomOnGroup()
    //     }
    //   }
    // });

    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });

  };


  //END SEARCH HIGHLIGHT


  Presenter.prototype = proto;

  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);
    eventbus.subscribe({
      topic: "Initiative.datasetLoaded",
      callback: function (data) {
        p.onInitiativeDatasetLoaded(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.new",
      callback: function (data) {
        p.onInitiativeNew(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.refresh",
      callback: function (data) {
        p.refreshInitiative(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: function (data) {
        p.onInitiativeReset(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.complete",
      callback: function () {
        p.onInitiativeLoadComplete();
        p.onInitiativeComplete();
      }
    });

    eventbus.subscribe({
      topic: "Initiative.loadStarted",
      callback: function (data) {
        p.onInitiativeLoadMessage(data);
      }
    });


    eventbus.subscribe({topic: "Initiative.stopLoading", callback: function(data) { p.onInitiativeLoadComplete(data); } });
    eventbus.subscribe({ topic: "Initiative.loadFailed", callback: function (data) { p.onInitiativeLoadMessage(data); } });
    // TODO - strip out this mechanism from everywhere it appears:
    //eventbus.subscribe({topic: "Initiative.selected", callback: function(data) { p.onInitiativeSelected(data); } });
    eventbus.subscribe({
      topic: "Markers.needToShowLatestSelection",
      callback: function (data) {
        p.onMarkersNeedToShowLatestSelection(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.needsToBeZoomedAndPanned",
      callback: function (data) {
        p.onMapNeedsToBeZoomedAndPanned(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.needToShowInitiativeTooltip",
      callback: function (data) {
        p.onNeedToShowInitiativeTooltip(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.needToHideInitiativeTooltip",
      callback: function (data) {
        p.onNeedToHideInitiativeTooltip(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.setZoom",
      callback: function (data) {
        p.setZoom(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.setActiveArea",
      callback: function (data) {
        p.setActiveArea(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.fitBounds",
      callback: function (data) {
        p.onBoundsRequested(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.selectAndZoomOnInitiative",
      callback: function (data) {
        p.selectAndZoomOnInitiative(data);
      }
    });



    eventbus.subscribe({
      topic: "Map.addFilter", //change this
      callback: function (data) {
        p.addFilter(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.refresh", //change this
      callback: function (data) {
        p.view.refresh();
      }
    });

    eventbus.subscribe({
      topic: "Map.removeFilter",
      callback: function (data) {
        p.removeFilter(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.removeFilters",
      callback: function (data) {
        p.removeFilters();
      }
    });

    eventbus.subscribe({
      topic: "Map.addSearchFilter",
      callback: function (data) {
        p.addSearchFilter(data);
      }
    });//change this to search

    eventbus.subscribe({
      topic: "Map.removeSearchFilter",
      callback: function (data) {
        p.removeSearchFilter();
      }
    });



    return p;
  }
  var pub = {
    createPresenter: createPresenter,
    getFiltered: getFiltered,
    getFilteredMap: getFilteredMap,
    getFilters: getFilters,
    getFiltersFull: getFiltersFull,
    getFiltersVerbose: getFiltersVerbose
  };
  return pub;
});
