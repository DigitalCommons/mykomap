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

  // An index of vocabulary terms in the data, obtained from get_vocabs.php
  let vocabs = {};
  
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
  let registeredValues = {}; // arrays of sorted values grouped by label, then by field
  const allRegisteredValues = {}; // arrays of sorted values, grouped by label

  function Initiative(e) {
    const that = this;

    let oldStyleValues = getOldStyleVerboseValuesForFields();

    function getCode(paramName) {
      const code = e[paramName];
      if (code)
        return getSkosCode(code);
      return undefined;
    }
    
    // Not all initiatives have activities


    // Define (some of) the properties we manage.
    //
    // - paramName: the name of the constructor paramter property
    // - propertyName: the name of the initiative instance property
    // - oldStyleValues: a legacy look-up key in `oldStyleValues`, also implies the property is a list.
    const classSchema = [
      {
        paramName: 'primaryActivity',
      },
      {
        paramName: 'qualifier',
        propertyName: 'qualifiers',
        oldStyleKey: 'Activities',
      },
      {
        paramName: 'activity',
        propertyName: 'otherActivities',
        oldStyleKey: 'Activities',
      },
      {
        paramName: 'regorg',
        propertyName: 'orgStructure',
        oldStyleKey: 'Organisational Structure',
      },
      {
        paramName: 'baseMembershipType',
      },
    ];
    
    // Compute the codes for certain fields
    const codes = Object.fromEntries(
      classSchema.map(p => [p.paramName, getCode(p.paramName)])
    );

    //if initiative exists already, just add properties
    if (initiativesByUid[e.uri] != undefined) {
      let initiative = initiativesByUid[e.uri];

      // If properties with oldStyleKey attributes are not present,
      // add them to the initiative. (Evidently this signifies,
      // or requires, a list property)
      classSchema
        .forEach(p => {
          if (!p.oldStyleKey)
            return;

          const code = codes[p.paramName];
          if (!code)
            return;
          
          const list = initiative[p.propertyName];
          if (list.includes(code))
            return;
          
          list.push(code);
          initiative.searchstr += oldStyleValues[p.oldStyleKey][code].toUpperCase();
        });

      //update pop-up
      eventbus.publish({ topic: "Initiative.refresh", data: initiative });
      return;
      //TODO: decide if then you index the secondary activities
    }

    const classSchema2 = [
      { propertyName: 'activity', value: codes.activity, writable: true },
      { propertyName: 'baseMembershipType', value: codes.baseMembershipType },
      { propertyName: 'country', value: e.country ? e.country : undefined },
      { propertyName: 'dataset', value: e.dataset },
      { propertyName: 'desc', value: e.desc },
      { propertyName: 'email', value: e.email },
      { propertyName: 'facebook', value: e.facebook },
      { propertyName: 'lat', value: e.lat, writable: true },
      { propertyName: 'lng', value: e.lng, writable: true },
      { propertyName: 'locality', value: e.locality },
      { propertyName: 'manLat', value: e.manLat, writable: true },
      { propertyName: 'manLng', value: e.manLng, writable: true },
      { propertyName: 'name', value: e.name },
      { propertyName: 'nongeoLat', value: config.getDefaultLatLng()[0] },
      { propertyName: 'nongeoLng', value: config.getDefaultLatLng()[1] },
      { propertyName: 'orgStructure', value: [], writable: true },
      { propertyName: 'otherActivities', value: [], writable: true },
      { propertyName: 'postcode', value: e.postcode },
      { propertyName: 'primaryActivity', value: codes.primaryActivity },
      { propertyName: 'qualifier', value: codes.qualifier },
      { propertyName: 'qualifiers', value: [], writable: true },
      { propertyName: 'region', value: e.region },
      { propertyName: 'regorg', value: codes.regorg },
      { propertyName: 'searchstr', value: genSearchValues(config.getSearchedFields(), e), writable: true },
      { propertyName: 'street', value: e.street },
      { propertyName: 'tel', value: e.tel },
      { propertyName: 'twitter', value: e.twitter },
      { propertyName: 'uniqueId', value: e.uri },
      { propertyName: 'uri', value: e.uri },
      { propertyName: 'within', value: e.within },
      { propertyName: 'www', value: e.www },
    ];

    classSchema2.forEach(p => {
      Object.defineProperty(this, p.propertyName, {
        value: p.value,
        enumerable: true,
        writable: !!p.writable,
      });
    });

    if (this.regorg) this.orgStructure.push(this.regorg);
    if (this.activity) this.otherActivities.push(this.activity);
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
      const fieldKey = filterable.field;
      const labelKey = filterable.label;
      const field = this[fieldKey];

      if (labelKey in allRegisteredValues)
        insert(this, allRegisteredValues[labelKey]);
      else
        allRegisteredValues[labelKey] = [this];

      if (field == null)
        return; // This initiative has no value for `fieldKey`, so can't be indexed further.

      if (labelKey in registeredValues) {
        const values = registeredValues[labelKey];
        if (field in values) {
          insert(this, values[field]);
        } else {
          values[field] = [this];
        }
      }
      else {
        // Create the object that holds the registered values for the current
        // field if it hasn't already been created
        const values = registeredValues[labelKey] = {};
        values[field] = [this];
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

    let oldStyleValues = getOldStyleVerboseValuesForFields();


    //handle special fields
    if (searchedFields.includes("primaryActivity")) {
      val += e.primaryActivity
        ? oldStyleValues["Activities"][getSkosCode(e.primaryActivity)]
        : "";
      searchedFields.splice(searchedFields.indexOf("primaryActivity"), 1);
    }

    if (searchedFields.includes("qualifier") || searchedFields.includes("qualifiers")) {
      val += e.qualifier
        ? oldStyleValues["Activities"][getSkosCode(e.qualifier)]
        : "";
      if (searchedFields.includes("qualifier"))
        searchedFields.splice(searchedFields.indexOf("qualifier"), 1);
      if (searchedFields.includes("qualifiers"))
        searchedFields.splice(searchedFields.indexOf("qualifiers"), 1);
    }

    if (searchedFields.includes("activity") || searchedFields.includes("otherActivities")) {
      val += e.activity
        ? oldStyleValues["Activities"][getSkosCode(e.activity)]
        : "";
      if (searchedFields.includes("activity"))
        searchedFields.splice(searchedFields.indexOf("activity"), 1);
      if (searchedFields.includes("otherActivities"))
        searchedFields.splice(searchedFields.indexOf("otherActivities"), 1);
    }

    if (searchedFields.includes("regorg") || searchedFields.includes("orgStructure")) {
      val += e.regorg
        ? oldStyleValues["Organisational Structure"][getSkosCode(e.regorg)]
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
  function getAllRegisteredValues() {
    return allRegisteredValues;
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


  // Incrementally loads the initiatives in `initiativesToLoad`, in
  // batches of `maxInitiativesToLoadPerFrame`, in the background so as to avoid
  // making the UI unresponsive. Re-invokes itself using `setTimeout` until all
  // batches are loaded.
  //
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
      datasetsLoaded++;
      if (datasetsLoaded >= datasetsToLoad)
        eventbus.publish({ topic: "Initiative.complete" }); //stop loading the specific dataset
    }
  }

  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param json - an array of inititive definitions
  function add(json) {
    console.log(json)

    initiativesToLoad = initiativesToLoad.concat(json);
    loadNextInitiatives();
  }

  //taken from 
  function insert(element, array) {
    array.splice(locationOf(element, array), 0, element);
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
      const labelValues = registeredValues[label];
      if (labelValues) {
        const ordered = {};
        Object.keys(labelValues).sort().forEach(function (key) {
          ordered[key] = labelValues[key];
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
  
  // Reloads the active data set (or sets)
  //
  // @param dataset - if boolean `true`, then all datasets will be loaded.
  // Otherwise, only the dataset with a matching name is loaded (if any).
  function reset(dataset) {
    // If the dataset is the same as that currently selected, nothing to do
    if(dataset === currentDatasets)
      return;

    loadedInitiatives = [];
    initiativesToLoad = [];
    initiativesByUid = {};
    registeredValues = {};


    //publish reset to map markers
    eventbus.publish({
      topic: "Initiative.reset",
      data: { dataset: "all" }
    });

    currentDatasets = dataset;
    loadFromWebService();
  }


  let startedLoading = false;
  let datasetsLoaded = 0;
  let datasetsToLoad = 0;

  
  // Loads the configured list of vocabs from the server.
  //
  // The list is defined in `config.json`
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  function loadVocabs() {
    const service = config.getServicesPath() + "get_vocabs.php";
    return d3.json(service);
  }  


  // Loads the currently active dataset(s) and configured vocabs
  //
  // This may be all of the datasets, or just a single selected one.
  // The vocabs are always loaded.
  function loadFromWebService() {
    // Active datasets indicated internally through `currentDatasets`
    let datasets = [];
    
    if (currentDatasets === true) {
      console.log("reset: loading all datasets ", config.namedDatasets());
      datasets = config.namedDatasets();
    }
    else if (allDatasets.includes(currentDatasets)) {
      console.log("reset: loading dataset '"+currentDatasets+"'");
      datasets = [currentDatasets];
    }
    else {
      console.log("reset: no matching dataset '"+currentDatasets+"'");
    }

    // Load the vocabs first, then on success or failure, load the
    // initiatives. Handlers defined below.
    loadVocabs()
      .then(onVocabSuccess)
      .catch(onVocabFailure)
      .finally(loadInitiatives);

    function loadInitiatives() {
      datasets.forEach(dataset =>
        loadDataset(dataset)
          .then(onDatasetSuccess(dataset))
          .catch(onDatasetFailure(dataset))
      );
    }

    function onVocabSuccess(response) {
      console.log("loaded vocabs", response);
      
      vocabs = response;
      
      // Add an inverted look-up `abbrevs` mapping abbreviations to uris
      vocabs.abbrevs = Object.keys(vocabs.prefixes).reduce((acc, key) => {
        const val = vocabs.prefixes[key];
        acc[val] = key;
        return acc;
      }, {});
      
      eventbus.publish({ topic: "Vocabularies.loaded" });
    }

    function onVocabFailure(error) {
      console.error("vocabs load failed", error);
      
      eventbus.publish({
        topic: "Vocabularies.loadFailed",
        data: { error: error }
      });     
    }  

    function onDatasetSuccess(dataset) {
      return (response) => {
        console.log("loaded "+dataset+" data", response);

        // Record a timestamp for this dataset
        performance.mark("startProcessing");
        
        add(response.data);
        eventbus.publish({ topic: "Initiative.datasetLoaded" });
      };
    }

    function onDatasetFailure(dataset) {
      return (error) => {
        console.error("load "+dataset+" data failed", error);
      
        eventbus.publish({
          topic: "Initiative.loadFailed",
          data: { error: error, dataset: dataset }
        });
      };
    }
  }


  // Loads the initiatives data for the given dataset (or all of them) from the server.
  //
  // The query is defined in the relevant dataset directory's `query.rq` file.
  //
  // @param dataset - the name of one of the configured datasets, or true to get all of them.
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  function loadDataset(dataset) {
    var service = config.getServicesPath() + "get_dataset.php?dataset=" + dataset;
    

    // Note, caching currently doesn't work correctly with multiple data sets
    // so until that's fixed, don't use it in that case.
    const numDatasets = config.namedDatasets().length;
    const noCache = numDatasets > 1? true : config.getNoLodCache();
    if (noCache) {
      service += "&noLodCache=true";
    }
    console.log("loadDataset", service);
    var response = null;
    var message = null;
    if (!startedLoading) {
      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Loading data via " + service, dataset: verboseDatasets[dataset] }
      });
      startedLoading = true;
    }

    return d3.json(service);
  }
  
  // This returns an index of vocabularies to term IDs to term labels.
  function getVerboseValuesForFields() {
    return vocabs;
  }

  const stripTerms = terms => {
    let newTerms = {};
    for(const termId in terms ){
      newTerms[termId.split(":")[1]] = terms[termId];
    }

    return newTerms;
  }

  function getOldStyleVerboseValuesForFields(){

    let oldStyleValues = {
      "Activities": stripTerms(vocabs.vocabs["essglobal:activities-ica/"].EN.terms),
      "Organisational Structure": stripTerms(vocabs.vocabs["essglobal:organisational-structure/"].EN.terms),
      "Base Membership Type": stripTerms(vocabs.vocabs["essglobal:base-membership-type/"].EN.terms)
    }

    return oldStyleValues;
  }

  const getVocabIDsAndInitiativeVariables = () => {
    let vocabIDsAndInitiativeVariables = {};

    //generated from filterableFields in the config
    filterableFields.forEach(filterableField => {
      vocabIDsAndInitiativeVariables[filterableField.vocabID] = filterableField.field;
    })

    return vocabIDsAndInitiativeVariables;
  }

  const getVocabTitlesAndVocabIDs = () => {
    const language = "EN";

    const vocabTitlesAndVocabIDs = {}

    for(const vocabID in vocabs.vocabs){
      vocabTitlesAndVocabIDs[vocabs.vocabs[vocabID][language].title] = vocabID;
    }

    return vocabTitlesAndVocabIDs;
  }

  //construct the object of terms for advanced search
  function getTerms(){
    const vocabIDsAndInitiativeVariables = getVocabIDsAndInitiativeVariables();

    const language = "EN";

    let usedTerms = {};

    for(const vocabID in vocabIDsAndInitiativeVariables){
      const vocabTitle = vocabs.vocabs[vocabID][language].title;
      usedTerms[vocabTitle] = {};
    }

    for(const initiativeUid in initiativesByUid ) {
      const initiative = initiativesByUid[initiativeUid];

      for(const vocabID in vocabIDsAndInitiativeVariables){
        const vocabTitle = vocabs.vocabs[vocabID][language].title;
        const [abbrev, postfix] = vocabID.split(":");
        // Find the prefix needed to expand the vocabID
        const prefix = vocabs.abbrevs[abbrev];
        if (!prefix)
          throw new Error(`No prefix defined for abbreviation '${abbrev}:' in vocab ID ${vocabID}`);
        const propName = vocabIDsAndInitiativeVariables[vocabID];
        const termID = initiative[propName];
        const termAbbrev = vocabs.prefixes[prefix+postfix];
        // abbreviate the URI if possible with the defined prefixes
        const termURI = termAbbrev? termAbbrev+":"+termID : prefix + postfix + termID;
        
        if(!usedTerms[vocabTitle][termID] && termID)
          usedTerms[vocabTitle][termID] = vocabs.vocabs[vocabID][language].terms[termURI];
      }
    }

    return usedTerms;
  }

  //get an array of possible filters from  a list of initiatives
  function getPossibleFilterValues(filteredInitiatives){
    let possibleFilterValues = [];

    const vocabIDsAndInitiativeVariables = getVocabIDsAndInitiativeVariables();

    filteredInitiatives.forEach(initiative => {
      for(const vocabID in vocabIDsAndInitiativeVariables){
        let termIdentifier = initiative[vocabIDsAndInitiativeVariables[vocabID]];

        if(!possibleFilterValues.includes(termIdentifier))
          possibleFilterValues.push(termIdentifier);
      }
    })

    return possibleFilterValues;
  }

  var pub = {
    loadFromWebService: loadFromWebService,
    search: search,
    latLngBounds: latLngBounds,
    getRegisteredValues: getRegisteredValues,
    getAllRegisteredValues: getAllRegisteredValues,
    getInitiativeByUniqueId: getInitiativeByUniqueId,
    filterDatabases: filterDatabases,
    getAllDatasets: getDatasets,
    reset: reset,
    getCurrentDatasets: getCurrentDatasets,
    getLoadedInitiatives: getLoadedInitiatives,
    getInitiativeUIDMap: getInitiativeUIDMap,
    getVerboseValuesForFields: getVerboseValuesForFields,
    getOldStyleVerboseValuesForFields: getOldStyleVerboseValuesForFields,
    getVocabIDsAndInitiativeVariables: getVocabIDsAndInitiativeVariables,
    getVocabTitlesAndVocabIDs: getVocabTitlesAndVocabIDs,
    getTerms: getTerms,
    getPossibleFilterValues: getPossibleFilterValues
  };
  // Automatically load the data when the app is ready:
  //eventbus.subscribe({topic: "Main.ready", callback: loadFromWebService});
  return pub;
});
