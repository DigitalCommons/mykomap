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
    (config.namedDatasetsVerbose() && config.namedDatasets().length == config.namedDatasetsVerbose().length) ?
      config.namedDatasetsVerbose()
      : [];

  // // TODO: We should get these values from the vocab, from config or from the source data
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
      AM120: "Reduce, Reuse, Repair & Recycle",
      AM130: "Agriculture",
      AM140: "Industry",
      AM150: "Utilities",
      AM160: "Transport",
      ICA10: "Agriculture",
      ICA20: "Dairy",
      ICA30: "Forestry",
      ICA40: "Irrigation",
      ICA50: "Fishery",
      ICA60: "Artisans",
      ICA70: "Construction",
      ICA80: "Industry",
      ICA90: "Manufacturing",
      ICA100: "Mining",
      ICA110: "Professional",
      ICA120: "Service",
      ICA130: "Tourism",
      ICA140: "Financial Services",
      ICA150: "Insurance",
      ICA160: "Education",
      ICA170: "Health",
      ICA180: "Community",
      ICA190: "Social",
      ICA200: "Social Service",
      ICA210: "Housing",
      ICA220: "Transport",
      ICA230: "Utility",
      ICA240: "Retail",
      ICA250: "Production",
      ICA260: "Wholesale and Retail",
      ICA270: "Education / Health / Social Work",
      ICA280: "Other Services",
      ICA290: "All",
      q09: "Coop Promoter/Supporter"
    },
    "Organisational Structure": {
      OS10: "Community group (formal or informal)",
      OS20: "Not-for-profit organisation",
      OS30: "Social enterprise",
      OS40: "Charity",
      OS50: "Company (Other)",
      OS60: "Workers co-operative",
      OS70: "Housing co-operative",
      OS80: "Consumer co-operative",
      OS90: "Producer co-operative",
      OS100: "Multi-stakeholder co-operative",
      OS110: "Secondary co-operative",
      OS115: "Co-operative",
      OS120: "Community Interest Company (CIC)",
      OS130: "Community Benefit Society / Industrial and Provident Society (IPS)",
      OS140: "Employee trust",
      OS150: "Self-employed",
      OS160: "Unincorporated",
      OS170: "Mutual",
      OS180: "National apex",
      OS190: "National sectoral federation or union",
      OS200: "Regional, state or provincial level federation or union",
      OS210: "Cooperative group",
      OS220: "Government agency/body",
      OS230: "Supranational",
      OS240: "Cooperative of cooperatives / mutuals"
    },
    "Base Membership Type": {
      BMT10: "Consumer/Users",
      BMT20: "Producers",
      BMT30: "Workers",
      BMT40: "Multi-stakeholders",
      BMT50: "Residents",
      BMT60: "Others"
    }
  };

  if (dsNamed.length == allDatasets.length)
    allDatasets.forEach((x, i) => verboseDatasets[x] = dsNamed[i]);
  else
    allDatasets.forEach((x, i) => verboseDatasets[x] = x);



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

    let qualifierCode = e.qualifier
      ? getSkosCode(e.qualifier)
      : undefined;

    let activityCode = e.activity
      ? getSkosCode(e.activity)
      : undefined;

    let regorgCode = e.regorg
      ? getSkosCode(e.regorg)
      : undefined;

    let membType = e.baseMembershipType
      ? getSkosCode(e.baseMembershipType)
      : undefined;

    //if initiative exists already, just add properties
    if (initiativesByUid[e.uri] != undefined) {
      let initiative = initiativesByUid[e.uri];


      //if the orgstructure is not in the initiative then add it
      if (regorgCode && !initiative.orgStructure.includes(regorgCode)) {
        initiative.orgStructure.push(regorgCode);
        initiative.searchstr += values["Organisational Structure"][regorgCode];
      }
      // if the activity is not in the initiative then add it
      if (activityCode && !initiative.activities.includes(activityCode)) {
        initiative.activities.push(activityCode);
        initiative.searchstr += values["Activities"][activityCode];
      }
      // if the qualifier is not in the initiative then add it
      if (qualifierCode && !initiative.qualifiers.includes(qualifierCode)) {
        initiative.qualifiers.push(qualifierCode);
        initiative.searchstr += values["Activities"][qualifierCode];
      }

      //update pop-up
      eventbus.publish({ topic: "Initiative.refresh", data: initiative });
      return;
      //TODO: decide if then you index the secondary activities
    }

    Object.defineProperties(this, {
      name: { value: e.name, enumerable: true },
      desc: { value: e.desc, enumerable: true },
      dataset: { value: e.dataset, enumerable: true },
      uri: { value: e.uri, enumerable: true },
      uniqueId: { value: e.uri, enumerable: true },
      within: { value: e.within, enumerable: true },
      lat: { value: e.lat, enumerable: true, writable: true },
      lng: { value: e.lng, enumerable: true, writable: true },
      manLat: { value: e.manLat, enumerable: true, writable: true },
      manLng: { value: e.manLng, enumerable: true, writable: true },
      www: { value: e.www, enumerable: true },
      regorg: { value: regorgCode, enumerable: true },
      street: { value: e.street, enumerable: true },
      locality: { value: e.locality, enumerable: true },
      postcode: { value: e.postcode, enumerable: true },
      country: {
        value: e.country ? e.country : undefined,
        enumerable: true
      },
      searchstr: {
        value: genSearchValues(config.getSearchedFields(), e)
        , enumerable: true, writable: true
      },
      primaryActivity: { value: primaryActivityCode, enumerable: true },
      activity: { value: activityCode, enumerable: true, writable: true },
      activities: { value: [], enumerable: true, writable: true },
      orgStructure: { value: [], enumerable: true, writable: true },
      tel: { value: e.tel, enumerable: true },
      email: { value: e.email, enumerable: true },
      nongeoLat: { value: config.getDefaultLatLng()[0], enumerable: true },
      nongeoLng: { value: config.getDefaultLatLng()[1], enumerable: true },
      twitter: { value: e.twitter, enumerable: true },
      facebook: { value: e.facebook, enumerable: true },
      region: { value: e.region, enumerable: true },
      qualifier: { value: qualifierCode, enumerable: true },
      qualifiers: { value: [], enumerable: true, writable: true },
      baseMembershipType: { value: membType, enumerable: true },

    });

    if (this.regorg) this.orgStructure.push(this.regorg);
    if (this.activity) this.activities.push(this.activity);
    if (this.qualifier) this.qualifiers.push(this.qualifier);

    //check if lat/lng are numbers and no letters in it
    if (isAlpha(that.lat) || isAlpha(that.lng)) {
      that.lat = undefined;
      that.lng = undefined;
    }

    //overwrite with manually added lat lng
    if (this.manLat || this.manLng) {
      this.lat = this.manLat;
      this.lng = this.manLng;
    }

    // loop through the filterable fields and register
    filterableFields.forEach(filterable => {
      let field = filterable.field;
      let label = filterable.label;
      // Create the object that holds the registered values for the current field if it hasn't already been created
      if (!registeredValues[label]) {
        registeredValues[label] = { All: [this] };
        registeredValues[label][this[field]] = [this];
      } else {
        // console.log(registeredValues[label]["All"]);
        registeredValues[label]["All"] = insert(this, registeredValues[label]["All"]);
        if (registeredValues[label][this[field]]) {
          registeredValues[label][this[field]] = insert(this, registeredValues[label][this[field]]);
        } else {
          registeredValues[label][this[field]] = [this];
        }
      }
    });

    insert(this, loadedInitiatives);
    initiativesByUid[this.uniqueId] = this;

    // Run new query to get activities
    // loadPluralObjects("activities", this.uniqueId);
    // Run new query to get organisational structure
    // loadPluralObjects("orgStructure", this.uniqueId); //, function() {
    eventbus.publish({ topic: "Initiative.new", data: that });
    // });
    // loadPluralObjects("orgStructure", this.uniqueId);
  }

  function genSearchValues(srch, e) {
    let searchedFields = [...srch]
    // Not all initiatives have activities
    let val = "";


    //handle special fields
    if (searchedFields.includes("primaryActivity")) {
      val += e.primaryActivity
        ? values["Activities"][getSkosCode(e.primaryActivity)]
        : "";
      searchedFields.splice(searchedFields.indexOf("primaryActivity"), 1);
    }

    if (searchedFields.includes("qualifier") || searchedFields.includes("qualifiers")) {
      val += e.qualifier
        ? values["Activities"][getSkosCode(e.qualifier)]
        : "";
      if (searchedFields.includes("qualifier"))
        searchedFields.splice(searchedFields.indexOf("qualifier"), 1);
      if (searchedFields.includes("qualifiers"))
        searchedFields.splice(searchedFields.indexOf("qualifiers"), 1);
    }

    if (searchedFields.includes("activity") || searchedFields.includes("activities")) {
      val += e.activity
        ? values["Activities"][getSkosCode(e.activity)]
        : "";
      if (searchedFields.includes("activity"))
        searchedFields.splice(searchedFields.indexOf("activity"), 1);
      if (searchedFields.includes("activities"))
        searchedFields.splice(searchedFields.indexOf("activities"), 1);
    }

    if (searchedFields.includes("regorg") || searchedFields.includes("orgStructure")) {
      val += e.regorg
        ? values["Organisational Structure"][getSkosCode(e.regorg)]
        : "";

      if (searchedFields.includes("regorg"))
        searchedFields.splice(searchedFields.indexOf("regorg"), 1);
      if (searchedFields.includes("orgStructure"))
        searchedFields.splice(searchedFields.indexOf("orgStructure"), 1);
    }

    //handle other fields
    val += searchedFields.map(x => e[x]).join("");

    //format
    val = val.toUpperCase();

    return val;

  }

  function isAlpha(str) {
    if (!str) return false;
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
    return a.name.localeCompare(b.name);
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
      return i.searchstr.includes(up);
    }).sort((a, b) => sortInitiatives(a, b));
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
      sortLoadedData();
      performance.mark("endProcessing");
      // var marks = performance.getEntriesByType("mark");
      console.info(
        `Time took to process all initiatives
        ${performance.getEntriesByName("endProcessing")[0].startTime -
        performance.getEntriesByName("startProcessing")[0].startTime}`
      );
      //if more left
      eventbus.publish({ topic: "Initiative.complete" }); //stop loading the specific dataset that you just loaded
    }
  }
  function add(json) {
    initiativesToLoad = initiativesToLoad.concat(json);
    loadNextInitiatives();
  }

  //taken from 
  function insert(element, array) {
    array.splice(locationOf(element, array), 0, element);
    let ar = [...array];
    // console.log(ar)
    return array;
  }

  function locationOf(element, array, start, end) {
    start = start || 0;
    end = end || array.length;
    var pivot = parseInt(start + (end - start) / 2, 10);
    if (end - start <= 1 || sortInitiatives(array[pivot], element) == 0) {
      //SPECIAL CASE FOR ARRAY WITH LEN = 1
      if (array.length == 1) {
        return sortInitiatives(array[0], element) == 1 ? 0 : 1;
      }
      else if
        (array.length > 1 && pivot == 0) return sortInitiatives(array[0], element) == 1 ? 0 : 1;
      else
        return pivot + 1;
    }

    if (sortInitiatives(array[pivot], element) > 0) {
      return locationOf(element, array, start, pivot);
    } else {
      return locationOf(element, array, pivot, end);
    }

  }

  //sorts only the filterable fields not the initiatives they hold
  function sortLoadedData() {
    // loop through the filters and sort them data, then sort the keys in order
    filterableFields.forEach(filterable => {
      let label = filterable.label;
      if (registeredValues[label]) {
        const ordered = {};
        Object.keys(registeredValues[label]).sort().forEach(function (key) {
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
  let startedLoading = false;
  function loadFromWebService() {
    var ds = config.namedDatasets();
    var i;
    //load all of them
    //load all from the begining if there are more than one
    if (ds.length > 1) {
      ds.forEach(dataset => {
        loadDataset(dataset, false, false);
      });
    }
    else if (ds.length == 1)
      loadDataset(ds[0]);

  }


  function loadDataset(dataset, mixed = false, sameas = true) {

    // var service = mixed
    //   ? config.getServicesPath() + "get_dataset.php?dataset=" + dataset + "&q=mixed"
    //   :
    //   (sameas ?
    //     config.getServicesPath() + "get_dataset.php?dataset=" + dataset
    //     : config.getServicesPath() + "get_dataset.php?dataset=" + dataset + "&q=nosameas");
    var service = config.getServicesPath() + "get_dataset.php?dataset=" + dataset;
    console.log(service);
    var response = null;
    var message = null;
    if (!startedLoading) {
      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Loading data via " + service, dataset: verboseDatasets[dataset] }
      });
      startedLoading = true;
    }
    else {
      //load at bottom of screen msg
    }
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
        data: { error: err, dataset: dataset }
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


  function getVerboseValuesForFields() {
    return values;
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
    getInitiativeUIDMap: getInitiativeUIDMap,
    getVerboseValuesForFields: getVerboseValuesForFields
  };
  // Automatically load the data when the app is ready:
  //eventbus.subscribe({topic: "Main.ready", callback: loadFromWebService});
  return pub;
});
