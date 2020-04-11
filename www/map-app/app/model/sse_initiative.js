// Model for SSE Initiatives.
define(["d3", "app/eventbus", "model/config"], function (d3, eventbus, config) {
  "use strict";

  let loadedInitiatives = [];
  let initiativesToLoad = [];
  let initiativesByUid = {};
  let allDatasets = config.namedDatasets();



  //TODO: should be in a method call
  //setup map
  let verboseDatasets = {}
  const dsNamed =
  (config.namedDatasetsVerbose() && config.namedDatasets().length == config.namedDatasetsVerbose().length)?
    config.namedDatasetsVerbose()
    :[];
  
  if(dsNamed.length == allDatasets.length)
    allDatasets.forEach((x,i) => verboseDatasets[x] = dsNamed[i]);
  else
    allDatasets.forEach((x,i) => verboseDatasets[x] = x);



  //true means all available datasets from config are loaded
  //otherwise a string to indicate which dataset is loaded
  let currentDatasets = true;


  // Need to record all instances of any of the fields that are specified in the config
  /* Format will be:
    [{
      "field": field,
      "label": label
    }]
  */
  const filterableFields = config.getFilterableFields();

  /* Format will be:
    {label :
      { field1: [ val1, val2 ... valN ] }
      ...
      { fieldN: [ ... ] },
    label2 :
      { field1: [ val1, val2 ... valN ] }
      ...
      { fieldN: [ ... ] }
    }
  */
  let registeredValues = {};

  function Initiative(e) {
    const that = this;
    // Not all initiatives have activities
    let primaryActivityCode = e.primaryActivity
      ? getSkosCode(e.primaryActivity)
      : undefined;

    Object.defineProperties(this, {
      name: { value: e.name, enumerable: true },
      desc: { value: e.desc, enumerable: true },
      dataset: { value: e.dataset, enumerable: true },
      uri: { value: e.uri, enumerable: true },
      uniqueId: { value: e.uri, enumerable: true },
      within: { value: e.within, enumerable: true },
      lat: { value: e.lat, enumerable: true, writable: true },
      lng: { value: e.lng, enumerable: true, writable: true },
      www: { value: e.www, enumerable: true },
      regorg: { value: e.regorg, enumerable: true },
      street: { value: e.street, enumerable: true },
      locality: { value: e.locality, enumerable: true },
      postcode: { value: e.postcode, enumerable: true },
      country: {
        value: e.country ? e.country : undefined,
        enumerable: true
      },
      searchstr: {
        value: config.getSearchedFields().map(x=>e[x]).join("")
        , enumerable: true
      },
      primaryActivity: { value: primaryActivityCode, enumerable: true },
      activity: { value: [], enumerable: true, writable: true },
      orgStructure: { value: [], enumerable: true, writable: true },
      tel: { value: e.tel, enumerable: true },
      email: { value: e.email, enumerable: true },
      nongeoLat: { value: config.getDefaultLatLng()[0], enumerable: true },
      nongeoLng: { value: config.getDefaultLatLng()[1], enumerable: true }
    });

    // loop through the filterable fields and register
    filterableFields.forEach(filterable => {
      let field = filterable.field;
      let label = filterable.label;
      // Create the object that holds the registered values for the current field if it hasn't already been created
      if (!registeredValues[label]) {
        registeredValues[label] = { All: [this] };
        registeredValues[label][this[field]] = [this];
      } else {
        registeredValues[label]["All"].push(this);
        // registeredValues[label]["ALL"].sort(function(a, b) {
        //   return sortInitiatives(a, b);
        // });
        if (registeredValues[label][this[field]]) {
          registeredValues[label][this[field]].push(this);
          // registeredValues[label][this[field]].sort(function(a, b) {
          //   return sortInitiatives(a, b);
          // });
        } else {
          registeredValues[label][this[field]] = [this];
        }
      }
    });

    //check if lat/lng are numbers and no letters in it
    if(isAlpha(that.lat) || isAlpha(that.lng))
    {
      that.lat = undefined;
      that.lng = undefined;
    }
    loadedInitiatives.push(this);
    initiativesByUid[this.uniqueId] = this;


    // Run new query to get activities
    // loadPluralObjects("activities", this.uniqueId);
    // Run new query to get organisational structure
    // loadPluralObjects("orgStructure", this.uniqueId); //, function() {
    eventbus.publish({ topic: "Initiative.new", data: that });
    // });
    // loadPluralObjects("orgStructure", this.uniqueId);
  }

  function isAlpha (str){
      if(!str) return false;
      var code, i, len;
    
      for (i = 0, len = str.length; i < len; i++) {
        code = str.charCodeAt(i);
        if (!(code > 64 && code < 91) && // upper alpha (A-Z)
            !(code > 96 && code < 123)) { // lower alpha (a-z)
          return false;
        }
      }
      return true;
  }

  function sortInitiatives(a, b) {

    let f1 = a.name.toLowerCase();
    let f2 = b.name.toLowerCase();
    if (f1 > f2) return 1;
    else if (f1 < f2) return -1;
    else return 0;
  }

  function getRegisteredValues() {
    return registeredValues;
  }
  function getInitiativeByUniqueId(uid) {
    return initiativesByUid[uid];
  }
  function getInitiativeUIDMap() {
    return initiativesByUid;
  }
  function search(text) {
    // returns an array of sse objects whose name contains the search text
    var up = text.toUpperCase();
    return loadedInitiatives.filter(function (i) {
      return i.searchstr.toUpperCase().includes(up);
    }).sort((a,b) => sortInitiatives(a,b));
  }

  function filter(filter) {

  }

  function getLoadedInitiatives() {
    return loadedInitiatives;
  }

  function filterDatabases(dbSource, all) {
    // returns an array of sse objects whose dataset is the same as dbSource
    //if boolean all is set to true returns all instead
    if (all)
      return loadedInitiatives;
    else {
      let up = dbSource.toUpperCase();
      return loadedInitiatives.filter(function (i) {
        return i.dataset.toUpperCase() === up;
      });
    }

  }

  function getDatasets() {
    return verboseDatasets;
  }

  function getCurrentDatasets() {
    return currentDatasets;
  }

  let cachedLatLon = [];
  function latLngBounds(initiatives) {
    // @returns an a pair of lat-long pairs that define the bounding box of all the initiatives,
    // The first element is south-west, the second north east
    //
    // Careful: isNaN(null) returns false ...
    if (!initiatives && cachedLatLon.length > 0) {
      return cachedLatLon;
    }

    const lats = (initiatives || loadedInitiatives)
      .filter(obj => obj.lat !== null && !isNaN(obj.lat))
      .map(obj => obj.lat);
    const lngs = (initiatives || loadedInitiatives)
      .filter(obj => obj.lng !== null && !isNaN(obj.lng))
      .map(obj => obj.lng);
    const west = Math.min.apply(Math, lngs);
    const east = Math.max.apply(Math, lngs);
    const south = Math.min.apply(Math, lats);
    const north = Math.max.apply(Math, lats);

    if (!initiatives) {
      cachedLatLon = [[south, west], [north, east]];
    }
    return [[south, west], [north, east]];
  }


  //NEEDS TO BE FIXED TO WORK WITH MULTIPLE DATASETS
  function loadNextInitiatives() {
    var i, e;
    var maxInitiativesToLoadPerFrame = 100;
    // By loading the initiatives in chunks, we keep the UI responsive
    for (i = 0; i < maxInitiativesToLoadPerFrame; ++i) {
      e = initiativesToLoad.pop();
      if (e !== undefined) {
        new Initiative(e);
      }
    }
    // If there's still more to load, we do so after returning to the event loop:
    if (e !== undefined) {
      setTimeout(function () {
        loadNextInitiatives();
      });
    } else {
      performance.mark("endProcessing");
      // var marks = performance.getEntriesByType("mark");
      console.info(
        `Time took to process all initiatives
        ${performance.getEntriesByName("endProcessing")[0].startTime -
        performance.getEntriesByName("startProcessing")[0].startTime}`
      );
      sortLoadedData();
      eventbus.publish({ topic: "Initiative.complete" });
    }
  }
  function add(json) {
    initiativesToLoad = initiativesToLoad.concat(json);
    loadNextInitiatives();
  }


  function sortLoadedData() {
    // loop through the filters and sort their data, then sort the keys in order
    filterableFields.forEach(filterable => {
      let label = filterable.label;
      console.log("number of initiatives to sort",loadedInitiatives.length);
      // Create the object that holds the registered values for the current field if it hasn't already been created
      if (registeredValues[label]) {
        /*unordered = 
          field1 => [initiatives],
          field2 => [initiatives],
          fieldN => [initiatives],
        */
        //sort keys and initiatives
        //TODO: do the same for activities (copy sort from directories)
        const ordered = {};
        Object.keys(registeredValues[label]).sort().forEach(function (key) {
          //sort initiatives
          registeredValues[label][key].sort(function(a, b) {
               return sortInitiatives(a, b);
           });
          //new order keys
          ordered[key] = registeredValues[label][key];
        });

        //finished
        registeredValues[label] = ordered;

      }
    });

  }

  function getSkosCode(originalValue) {
    let split = originalValue.split("/");
    return split[split.length - 1];
  }

  function registerActivity(activity, initiative) {
    activity = getSkosCode(activity);
    if (registeredActivities[activity])
      registeredActivities[activity].push(initiative);
    else {
      delete registeredActivities.loading;
      registeredActivities[activity] = [initiative];
    }
  }
  function errorMessage(response) {
    // Extract error message from parsed JSON response.
    // Returns error string, or null if no error.
    // API response uses JSend: https://labs.omniti.com/labs/jsend
    switch (response.status) {
      case "error":
        return response.message;
      case "fail":
        return response.data.toString();
      case "success":
        return null;
      default:
        return "Unexpected JSON error message - cannot be extracted.";
    }
  }
  function reset(dataset) {
    loadedInitiatives = [];
    initiativesToLoad = [];
    initiativesByUid = {};
    registeredValues = {};


    //publish reset to map markers
    eventbus.publish({
      topic: "Initiative.reset",
      data: { dataset: "all" }
    });

    if (allDatasets.includes(dataset)) {
      currentDatasets = dataset;
      loadDataset(dataset);
    }
    else {
      //return true to signal that all datasets are loaded
      currentDatasets = true;
      loadFromWebService();
      console.log("loading mixed dataset");

    }

  }


  //TODO: this whole structure will be pretty glitchy when multithreaded
  //need to fix this
  function loadFromWebService() {
    var ds = config.namedDatasets();
    var i;
    //load all of them
    //load all from the begining if there are more than one
    if (ds.length > 1) {
      loadDataset(ds[0], true);
      ds.forEach(dataset => {
        loadDataset(dataset, false, false);
      });


    }
    else if (ds.length == 1)
      loadDataset(ds[0]);

  }


  function loadDataset(dataset, mixed = false, sameas = true) {

    var service = mixed
      ? config.getServicesPath() + "get_dataset.php?dataset=" + dataset + "&q=mixed"
      :
      (sameas ?
        config.getServicesPath() + "get_dataset.php?dataset=" + dataset
        : config.getServicesPath() + "get_dataset.php?dataset=" + dataset + "&q=nosameas");

    console.log(service);
    var response = null;
    var message = null;
    eventbus.publish({
      topic: "Initiative.loadStarted",
      data: { message: "Loading data via " + service, dataset:verboseDatasets[dataset] }
    });
    // We want to allow the effects of publishing the above event to take place in the UI before
    // continuing with the loading of the data, so we allow the event queue to be processed:
    //setTimeout(function() {
    d3.json(service).then(function (json) {
      // This now uses d3.fetch and the fetch API.
      // TODO - error handling
      // TODO - publish events (e.g. loading, success, failure)
      //        so that the UI can display info about datasets.
      // console.log(json);
      console.log(json);
      console.info("Recording entire process");
      performance.mark("startProcessing");
      add(json.data);
      //sort if this is the last dataset you are loading 
      eventbus.publish({ topic: "Initiative.datasetLoaded" });
    }).catch(err => {
      eventbus.publish({
        topic: "Initiative.loadFailed",
        data: { error: err,dataset:dataset}
      });
      console.log(err)
    });
  }
  function loadPluralObjects(query, uid, callback) {
    var ds = config.namedDatasets();
    for (let i in ds) {
      var service =
        config.getServicesPath() +
        "get_dataset.php?dataset=" +
        ds[i] +
        "&q=" +
        query +
        "&uid=" +
        uid;
      var response = null;
      var message = null;
      d3.json(service).then(function (json) {
        for (let result of json.data) {
          let initiative;
          for (let key in result) {
            if (!initiative) initiative = result[key];
            else if (key !== "dataset") {
              initiativesByUid[initiative][key].push(getSkosCode(result[key]));
              if (key === "activity")
                registerActivity(result[key], initiativesByUid[initiative]);
            }
          }
        }
        if (callback) callback();
      });
    }
  }
  var pub = {
    loadFromWebService: loadFromWebService,
    search: search,
    latLngBounds: latLngBounds,
    getRegisteredValues: getRegisteredValues,
    getInitiativeByUniqueId: getInitiativeByUniqueId,
    filterDatabases: filterDatabases,
    getAllDatasets: getDatasets,
    reset: reset,
    getCurrentDatasets: getCurrentDatasets,
    getLoadedInitiatives: getLoadedInitiatives,
    getInitiativeUIDMap: getInitiativeUIDMap
  };
  // Automatically load the data when the app is ready:
  //eventbus.subscribe({topic: "Main.ready", callback: loadFromWebService});
  return pub;
});
