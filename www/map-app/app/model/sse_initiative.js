// Model for SSE Initiatives.
"use strict";
const d3 = require('d3');
const eventbus = require('../eventbus');
const getDatasetPhp = require("../../../services/get_dataset.php");
const getVocabsPhp = require("../../../services/get_vocabs.php");
const { json } = require('d3');


function init(registry) {
  const config = registry("config");

  const fallBackLanguage = "EN";

  let language;
  if (config.getLanguage())
    language = config.getLanguage();
  else
    language = fallBackLanguage;

  let functionalLabels = {
    EN: {
      directory: "Directory",
      showDirectory: "Show directory",
      showSearch: "Show search",
      showInfo: "Show info",
      hideDirectory: "Hide directory",
      close: "Close ",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      search: "Search",
      whenSearch: "When you search, or click on map markers, you'll see the results here",
      loading: "Loading ...",
      showDatasets: "Show datasets",
      searchInitiatives: "Search initiatives",
      any: "Any",
      searchIn: "Search in ?",
      clearFilters: "Clear Filters",
      contact: "Contact",
      allEntries: "All Entries",
      aboutTitle: "About",
      underConstruction: "This section is under construction.",
      source: "The source data of this content is ",
      technicalInfo: "Technical information about the technology behind this map and directory can be found ",
      here: "here",
      contributers: "contributers",
      otherData: "Other data",
      datasets: "Datasets",
      mixedSources: "Mixed Sources",
      poweredBy: "Powered by",
      mapDisclaimer: "This map contains indications of areas where there are disputes over territories. The ICA does not endorse or accept the boundaries depicted on the map.",
      property_shortPostcode: "Short postcode",
    },
    FR: {
      directory: "Annuaire",
      showDirectory: "Afficher l’annuaire",
      showSearch: "Afficher la recherche",
      showInfo: "Afficher les informations",
      hideDirectory: "Masquer l’annuaire",
      close: "Fermer ",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arrière",
      search: "Rechercher",
      whenSearch: "Lorsque vous effectuez une recherche ou cliquez sur les repères de la carte, les résultats s’affichent ici.",
      loading: "Chargement des données",
      showDatasets: "Afficher les ensembles de données",
      searchInitiatives: "Rechercher des initiatives",
      any: "Tout afficher",
      searchIn: "Rechercher dans ?",
      clearFilters: "Réinitialiser les filtres",
      contact: "Contact",
      allEntries: "Toutes les entrées",
      aboutTitle: "À propos",
      underConstruction: "Cette section est en construction.",
      source: "Les données sources de ce contenu se trouvent ",
      technicalInfo: "Des informations techniques sur la technologie qui sous-tend cette carte et ce répertoire sont disponibles ",
      here: "ici",
      contributers: "Contributeurs",
      otherData: "Autres données",
      datasets: "Ensembles de données",
      mixedSources: "Sources mixtes",
      poweredBy: "Créé par",
      mapDisclaimer: "Cette carte contient des indications sur les zones où il y a des différends au sujet territorial. L'ACI n'approuve ni n'accepte les frontières représentées sur la carte.",
      property_shortPostcode: "Code postal court",
    },
    ES: {
      directory: "Directorio",
      showDirectory: "Mostrar directorio",
      showSearch: "Mostrar búsqueda",
      showInfo: "Mostrar información",
      hideDirectory: "Ocultar directorio",
      close: "Cerrar ",
      zoomIn: "Acercar",
      zoomOut: "Alejar",
      search: "Buscar",
      whenSearch: "Los resultados de la búsqueda o selección en los marcadores del mapa se mostrarán aquí.",
      loading: "Cargando…",
      showDatasets: "Mostrar conjuntos de datos",
      searchInitiatives: "Buscar iniciativas",
      any: "Qualquiera",
      searchIn: "Buscar en…",
      clearFilters: "Borrar filtros",
      contact: "Contacto",
      allEntries: "Todas las entradas",
      aboutTitle: "Sobre este mapa",
      underConstruction: "Esta sección está en construcción.",
      source: "Los datos de origen de este contenido están ",
      technicalInfo: "La información técnica sobre la tecnología que hay detrás de este mapa y directorio se puede encontrar ",
      here: "aquí",
      contributers: "Colaboradores",
      otherData: "Otros datos",
      datasets: "Conjuntos de datos",
      mixedSources: "Fuentes mixtas",
      poweredBy: "Desarrollado por",
      mapDisclaimer: "Este mapa contiene indicaciones de zonas donde hay disputas territoriales. La ACI no respalda ni acepta las fronteras representadas en el mapa.",
      property_shortPostcode: "Código postal corto",
    },
    KO: {
      directory: "디렉토리",
      showDirectory: "디렉토리 표시",
      showSearch: "검색 표시",
      showInfo: "정보 표시",
      hideDirectory: "디렉토리 숨기기",
      close: "닫기",
      zoomIn: "확대",
      zoomOut: "축소",
      search: "검색",
      whenSearch: "검색하거나 지도 마커를 클릭하면 여기에 결과가 표시됩니다.",
      loading: "로드 중...",
      showDatasets: "데이터 세트 표시",
      searchInitiatives: "검색 이니셔티브",
      any: "모든",
      searchIn: "검색 ?",
      clearFilters: "필터 지우기",
      contact: "연락처",
      allEntries: "모든 항목",
      aboutTitle: "정보",
      underConstruction: "이 섹션은 공사 중입니다.",
      source: "이 콘텐츠의 소스 데이터는 ",
      technicalInfo: "이 지도 및 디렉토리 이면의 기술에 대한 기술 정보를 찾을 수 있습니다.",
      here: "여기",
      contributers: "기고자",
      otherData: "기타 데이터",
      datasets: "데이터세트",
      mixedSources: "혼합 소스",
      poweredBy: "에 의해 구동",
      mapDisclaimer: "이 지도에는 영토에 대한 분쟁이 있는 지역의 표시가 포함되어 있습니다. ICA는 지도에 표시된 경계를 승인하거나 수락하지 않습니다.",
      property_shortPostcode: "짧은 우편번호",
    }
  }

  // Define the properties in an initiative and how to manage them. Note, thanks to JS
  // variable hoisting semantics, we can reference initialiser functions below, if they are
  // normal functions.
  //
  // - propertyName: the name of the initiative instance property. Should be unique!
  // - paramName: the name of the constructor paramter property. Not necessarily unique.
  // - init: a function to initialise the property, called with this property's schema
  //   definition and a parameters object.
  // - writable: if true, the property can be assigned to. (Defaults to `false`)
  // - vocabUri: a legacy look-up key in `vocabs.vocabs`, needed when the initialiser is `fromCode`.
  //
  const classSchema = [
    { propertyName: 'activity', paramName: 'activity', init: fromCode, writable: true, vocabUri: 'aci:' },
    { propertyName: 'baseMembershipType', paramName: 'baseMembershipType', init: fromCode, vocabUri: 'bmt:' },
    { propertyName: 'countryId', paramName: 'countryId', init: fromCode, vocabUri: 'coun:' },
    { propertyName: 'dataset', paramName: 'dataset', init: fromParam },
    { propertyName: 'desc', paramName: 'desc', init: fromParam },
    { propertyName: 'email', paramName: 'email', init: fromParam },
    { propertyName: 'facebook', paramName: 'facebook', init: fromParam },
    { propertyName: 'lat', paramName: 'lat', init: fromParam, writable: true },
    { propertyName: 'lng', paramName: 'lng', init: fromParam, writable: true },
    { propertyName: 'locality', paramName: 'locality', init: fromParam },
    { propertyName: 'manLat', paramName: 'manLat', init: fromParam, writable: true },
    { propertyName: 'manLng', paramName: 'manLng', init: fromParam, writable: true },
    { propertyName: 'name', paramName: 'name', init: fromParam },
    { propertyName: 'nongeoLat', init: def => config.getDefaultLatLng()[0] },
    { propertyName: 'nongeoLng', init: def => config.getDefaultLatLng()[1] },
    { propertyName: 'orgStructure', paramName: 'regorg', init: asList, writable: true, vocabUri: 'os:' },
    { propertyName: 'otherActivities', paramName: 'activity', init: asList, writable: true, vocabUri: 'aci:' },
    { propertyName: 'postcode', paramName: 'postcode', init: fromParam },
    { propertyName: 'shortPostcode', paramName: 'postcode',
      init: (def, params) => {
        // Regex adapted from here, combining UK and British Territories and Armed Forces
        // Will be null if there is no match.
        if (params.postcode == null)
          return null;
	      const match = params
          .postcode
          .toUpperCase()
          .match(/^([A-Z][A-HJ-Y]?[0-9][A-Z0-9]?|ASCN|STHL|TDCU|BBND|[BFS]IQQ|GX\d{2}|PCRN|TKCA|BFPO)/);
        return match? match[0] : undefined;
      },
    },
    { propertyName: 'primaryActivity', paramName: 'primaryActivity', init: fromCode, vocabUri: 'aci:' },
    { propertyName: 'qualifier', paramName: 'qualifier', init: fromCode, vocabUri: 'aci:' }, // note dupe paramName following
    { propertyName: 'qualifiers', paramName: 'qualifier', init: asList, writable: true, vocabUri: 'aci:' },
    { propertyName: 'region', paramName: 'region', init: fromParam },
    { propertyName: 'regionId', paramName: 'regionId', init: fromCode, vocabUri: 'reg:' },
    { propertyName: 'regorg', paramName: 'regorg', init: fromCode, vocabUri: 'os:' },
    { propertyName: 'searchstr', init: asSearchStr, writable: true },
    { propertyName: 'street', paramName: 'street', init: fromParam },
    { propertyName: 'superRegionId', paramName: 'superRegionId', init: fromCode, vocabUri: 'sreg:' },
    { propertyName: 'tel', paramName: 'tel', init: fromParam },
    { propertyName: 'twitter', paramName: 'twitter', init: fromParam },
    { propertyName: 'uniqueId', paramName: 'uri', init: fromParam },
    { propertyName: 'uri', paramName: 'uri', init: fromParam },
    { propertyName: 'within', paramName: 'within', init: fromParam },
    { propertyName: 'www', paramName: 'www', init: fromParam },
  ];

  // Initialiser which uses the appropriate parameter name
  function fromParam(def, params) {
    return params[def.paramName];
  }

  // Initialiser which uses the appropriate code
  function fromCode(def, params) {
    const uri = params[def.paramName];
    if (uri)
      return abbrevUri(uri);
    return undefined;
  }

  // Initialiser which returns an empty array
  function asList(def, params) {
    return [];
  }

  // Initialiser for the search string.
  //
  // Scans the searchedFields, using the classSchema to extract
  // the relevant values from the parameters, which are combined
  // together as an uppercased string for matching against later.
  //
  // Note, we match searchedFields to the *propertyNames* (of the
  // initiative object), not the *paramNames* (from the query).
  // This distinction is important as they sometimes differ.
  //
  // Note: as multiple properties *can be* (and currently are) constructed
  // from the same constructor parameter, this means in these cases that
  // the same parameter value can be added to the searchabe string twice.
  // This should not be a problem for searching, it just makes the strings
  // in these cases a bit longer than they strictly need to be,
  //
  // Assumption: no parameters are transformed during the initialisation
  // of the equivalent properties. i.e. We are constructing the string
  // from parameter values, not object property values. If they do differ
  // this means the search results may not be what we expect.
  function asSearchStr(def, params) {
    const searchedFields = config.getSearchedFields();

    const searchableValues = [];

    searchedFields.forEach(fieldName => {
      // Get the right schema for this field (AKA property)
      const def = classSchema.find(p => p.propertyName === fieldName);
      if (!def) {
        console.warn(`searchable field '${fieldName}' is not a recognised field name`)
        return;
      }

      const value = def.init === fromCode ? // Does this field contains an ID?
        lookupIdentifier() :
        def.init === asList ? // Is it a list of IDs (currently IDs implied by list)
          lookupIdentifier() : // Singular - just need to do this param
          lookupValue();

      if (value !== undefined)
        searchableValues.push(value);
      return; // Done. Only functions below.

      function lookupIdentifier() {
        // Add any parameter values named
        const id = params[def.paramName];
        if (!def.vocabUri) {
          console.warn(`missing vocabUri for property '${def.propertyName}'`);
          return undefined;
        }
        const value = getVocabTerm(def.vocabUri, id);
        if (value === undefined) {
          console.warn(`no value defined for ID '${id}' in property '${def.propertyName}'`);
          return undefined;
        }
        return value;
      }
      function lookupValue() {
        const value = params[def.paramName];
        if (value === undefined) {
          console.warn(`no value for searchable field '${fieldName}' in initiative ${params.uri}`)
          return;
        }
        return value;
      }
    });

    // Join searchable values, squash case
    // console.log(params.name, searchableValues.join(" ").toUpperCase()); // DEBUG
    return searchableValues.join(" ").toUpperCase();
  }

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
  // Expects an array of strings which are initiative field names.
  const filterableFields = config.getFilterableFields();
  if (typeof (filterableFields) !== 'object' || !(filterableFields instanceof Array))
    throw new Error(`invalid filterableFields config for 'filterableFields' - not an array`);
  if (filterableFields.findIndex(e => typeof (e) !== 'string') >= 0)
    throw new Error(`invalid filterableFields config for 'filterableFields' - contains non-strings`);

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
  let allRegisteredValues = {}; // arrays of sorted values, grouped by label

  function Initiative(e) {
    const that = this;

    // Not all initiatives have activities

    //if initiative exists already, just add properties
    if (initiativesByUid[e.uri] != undefined) {
      let initiative = initiativesByUid[e.uri];

      // If properties with are multi-valued, add new values to the
      // initiative.  This is to handle cases where the SPARQL
      // resultset contains multple rows for a multi-value field with
      // multiple values.
      classSchema
        .forEach(p => {
          if (p.init !== asList)
            return;

          // Assume these are always ID fields (enums) for now,
          // although this is not necessarily always true, just
          // because this has historically been assumed. We can
          // generalise this later.

          const code = fromCode(p, e);
          if (!code)
            return;

          const list = initiative[p.propertyName];
          if (list.includes(code))
            return;

          list.push(code);
          const uri = e[p.paramName];
          const value = getVocabTerm(p.vocabUri, uri);
          if (value === undefined) {
            console.warn(`can't add term '${uri}' to search, ` +
              `it is not part of the vocab '${p.vocabUri}'`);
            return;
          }

          initiative.searchstr = [
            initiative.searchstr,
            value.toUpperCase()
          ].join(" ");
        });

      //update pop-up
      eventbus.publish({ topic: "Initiative.refresh", data: initiative });
      return;
      //TODO: decide if then you index the secondary activities
    }

    // Define and initialise the instance properties.
    classSchema.forEach(p => {
      Object.defineProperty(this, p.propertyName, {
        value: p.init(p, e),
        enumerable: true,
        writable: !!p.writable,
      });
    });

    // Post-initialisation adjustments, typically requiring
    // a birds-eye view of the instance.

    if (this.regorg) this.orgStructure.push(this.regorg);
    if (this.activity) this.otherActivities.push(this.activity);
    if (this.qualifier) this.qualifiers.push(this.qualifier);

    //check if lat/lng are numbers and no letters in it
    if (isAlpha(that.lat) || isAlpha(that.lng)) {
      that.lat = undefined;
      that.lng = undefined;
    }

    //overwrite with manually added lat lng
    if (this.manLat && this.manLat != "0" || this.manLng && this.manLng != "0") {
      this.lat = this.manLat;
      this.lng = this.manLng;
    }

    // loop through the filterable fields AKA properties, and register
    filterableFields.forEach(filterable => {
      const labelKey = getTitleForProperty(filterable);
      
      if (labelKey in allRegisteredValues)
        insert(this, allRegisteredValues[labelKey]);
      else
        allRegisteredValues[labelKey] = [this];

      const field = this[filterable];
      if (field == null) {
        // This initiative has no value for `filterable`, so can't be indexed further.
        console.warn(`Initiative has no value for filter field ${filterable}: ${this.uri}`);
        return;
      }

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

    eventbus.publish({ topic: "Initiative.new", data: that });
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

  function addInitiatives(initiatives) {
    initiatives.forEach(elem => new Initiative(elem));
  }

  function finishInitiativeLoad() {
    sortLoadedData();
    //if more left
    datasetsLoaded++;
    if (datasetsLoaded >= datasetsToLoad)
      eventbus.publish({ topic: "Initiative.complete" }); //stop loading the specific dataset
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
      addInitiatives(initiativesToLoad.splice(0, maxInitiativesToLoadPerFrame));
    }
    // If there's still more to load, we do so after returning to the event loop:
    if (initiativesToLoad.length) {
      setTimeout(function () {
        loadNextInitiatives();
      });
    } else {
      finishInitiativeLoad();
    }
  }

  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param json - an array of inititive definitions
  function add(json) {
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
      const label = getTitleForProperty(filterable);
      
      const labelValues = registeredValues[label];
      if (labelValues) {
        const propDef = getPropertySchema(filterable);
        const ordered = Object
          .entries(labelValues)
          .sort(propDef.vocabUri? sortByVocabLabel : sortAsString)
        // FIXME ideally we'd sort numbers, booleans, etc. appropriately

        registeredValues[label] = Object.fromEntries(ordered);
      }

      // Sort entries by the vocab label for the ID used as the key
      function sortByVocabLabel(a, b) {
        const alab = vocab.terms[a[0]];
        const blab = vocab.terms[b[0]];
        return String(alab).localeCompare(String(blab));
      }
      // Sort entries as strings
      function sortAsString(a, b) {
        return String(a[0]).localeCompare(String(b[0]));
      }
    });

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
    if (dataset === currentDatasets)
      return;

    startedLoading = false;
    loadedInitiatives = [];
    initiativesToLoad = [];
    initiativesByUid = {};
    registeredValues = {};
    allRegisteredValues = {};

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
  async function loadVocabs() {
    return d3.json(getVocabsPhp);
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
      console.log("reset: loading dataset '" + currentDatasets + "'");
      datasets = [currentDatasets];
    }
    else {
      console.log("reset: no matching dataset '" + currentDatasets + "'");
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

      setVocab(response);
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
        console.log("loaded " + dataset + " data", response);

        console.log(response.data);
        add(response.data);
        eventbus.publish({ topic: "Initiative.datasetLoaded" });
      };
    }

    function onDatasetFailure(dataset) {
      return (error) => {
        console.error("load " + dataset + " data failed", error);

        eventbus.publish({
          topic: "Initiative.loadFailed",
          data: { error: error, dataset: dataset }
        });
      };
    }
  }

  function setVocab(data) {
    vocabs = data;

    // Add an inverted look-up `abbrevs` mapping abbreviations to uris
    // obtained from `prefixes`.
    //
    // Sort it and `prefixes` so that longer prefixes are listed
    // first (Ecmascript objects preserve the order of addition).
    // This is to make matching the longest prefix simpler later.
    const prefixes = {};
    const abbrevs = {};
    Object
      .keys(vocabs.prefixes)
      .sort((a, b) => b.length - a.length)
      .forEach(prefix => {
        const abbrev = vocabs.prefixes[prefix];
        abbrevs[abbrev] = prefix;
        prefixes[prefix] = abbrev;
      });

    vocabs.prefixes = prefixes;
    vocabs.abbrevs = abbrevs;
    if (!vocabs.vocabs)
      vocabs.vocabs = []; // Ensure this is here

    eventbus.publish({ topic: "Vocabularies.loaded" });
  }


  // Loads the initiatives data for the given dataset (or all of them) from the server.
  //
  // The query is defined in the relevant dataset directory's `query.rq` file.
  //
  // @param dataset - the name of one of the configured datasets, or true to get all of them.
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  function loadDataset(dataset) {

    let service = `${getDatasetPhp}?dataset=${encodeURIComponent(dataset)}`;

    // Note, caching currently doesn't work correctly with multiple data sets
    // so until that's fixed, don't use it in that case.
    const numDatasets = config.namedDatasets().length;
    const noCache = numDatasets > 1 ? true : config.getNoLodCache();
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

  function getDialogueSize() {
    const dialogueSize = config.getDialogueSize();

    if (typeof (dialogueSize) == "string")
      return JSON.parse(dialogueSize);
    else
      return dialogueSize;
  }

  function getVerboseValuesForFields() {

    const entries = Object
      .entries(vocabs.vocabs)
      .map(([vocabUri, vocab]) => {
        const vocabLang = vocab[language] ? vocab[language] : vocab[fallBackLanguage];
        if (vocabLang == vocab[fallBackLanguage] && language != fallBackLanguage) {
          console.error(`No ${language} localisation for vocab '${language}, falling back to ${fallBackLanguage}'`);
        }
        return [vocabLang.title, vocabLang.terms];
      });

    return Object.fromEntries(entries);
  }

  function getLocalisedVocabs() {
    const vocabLang = vocabs.vocabs["aci:"][language] ? language : fallBackLanguage;

    let verboseValues = {};

    for (const id in vocabs.vocabs) {
      verboseValues[id] = vocabs.vocabs[id][vocabLang];
    }

    return verboseValues;
  }

  const getVocabIDsAndInitiativeVariables = () => {
    let vocabIDsAndInitiativeVariables = {};

    // Generate the index from filterableFields in the config
    filterableFields.forEach(filterableField => {
      const vocabUri = getPropertySchema(filterableField).vocabUri;
      if (vocabUri)
        vocabIDsAndInitiativeVariables[vocabUri] = filterableField;
    })
    return vocabIDsAndInitiativeVariables;
  }

  const getVocabTitlesAndVocabIDs = () => {
    const vocabTitlesAndVocabIDs = {}

    for (const vocabID in vocabs.vocabs) {
      const vocabLang = vocabs.vocabs[vocabID][language] ? language : fallBackLanguage;
      vocabTitlesAndVocabIDs[vocabs.vocabs[vocabID][vocabLang].title] = vocabID;
    }

    return vocabTitlesAndVocabIDs;
  }

  // Expands a URI using the prefixes/abbreviations defined in vocabs
  //
  // Keeps trying until all expansions applied.
  function expandUri(uri) {
    while (true) {
      const delimIx = uri.indexOf(':');
      if (delimIx < 0)
        return uri; // Shouldn't normally happen... expanded URIs have `http(s):`

      const abbrev = uri.substring(0, delimIx);
      if (abbrev == 'http' || abbrev == 'https')
        return uri; // No more expansion needed

      if (abbrev in vocabs.abbrevs) // Expand this abbreviation
        uri = vocabs.abbrevs[abbrev] + uri.substring(delimIx + 1);
    }
  }

  // Abbreviates a URI using the prefixes/abbreviations defined in vocabs
  //
  // Keeps trying until all abbreviations applied.
  function abbrevUri(uri) {
    uri = expandUri(uri); // first expand it, if necessary

    // Find a prefix match
    const prefix = Object
      .keys(vocabs.prefixes) // NOTE: assumes this object is sorted largest-key first
      .find(p => uri.startsWith(p));

    // Substitute the match with the abbreviation.
    if (prefix)
      return vocabs.prefixes[prefix] + ':' + uri.substring(prefix.length);

    return uri; // No abbreviation possible.
  }

  // Gets a vocab term value, given an (possibly prefixed) vocab and term uris
  function getVocabTerm(vocabUri, termUri) {
    const vocabLang = vocabs.vocabs[vocabUri][language] ? language : fallBackLanguage;
    termUri = abbrevUri(termUri);
    // We don't (yet) expand or abbreviate vocabUri. We assume it matches.
    return vocabs.vocabs[vocabUri][vocabLang].terms[termUri];
  }

  // Gets the schema definition for a property.
  //
  // Returns a schema definition, or throws an error null if there is no such property. 
  function getPropertySchema(propName) {
    const propDef = classSchema.find(p => p.propertyName === propName)
    if (!propDef) {
      throw new Error(`unrecognised property name: '${propName}'`);
    }

    return propDef;
  }

  // Gets the vocab for a property, given the property schema
  //
  // Returns a vocab index (for the currently set language).
  //
  // Throws an exception if there is some reason this fails. The
  // exception will have a short description indicating the problem.
  function getVocabForProperty(propDef) {

    // Assume classSchema's vocabUris are validated. But language availability can't be
    // checked so easily.
    const vocab = vocabs.vocabs[propDef.vocabUri];
    if (!vocab) {
      throw new Error(`no vocab defined with URI ${propDef.vocabUri} `+
                      `(expecting one of: ${Object.keys(vocabs.vocabs).join(', ')})`);
    }
    const vocabLang = vocab[language] ? language : fallBackLanguage;
    const localVocab = vocab[vocabLang];
    if (!localVocab) {
      throw new Error(`no title in lang ${vocabLang} for property: '${propDef.name}'`);
    }

    return localVocab;
  }

  function getTitleForProperty(propName) {
    let title = propName; // Fallback value

    try {
      // First get the property definition (this will throw if it's not defined)
      const propDef = getPropertySchema(propName);

      // If the field is a vocab field
      if (propDef.vocabUri) {
        // Look up the title via the vocab (this may also throw)
        title = getVocabForProperty(propDef).title;
      }
      else {
        // Look up the title via functionalLabels, if present
        const labels = getFunctionalLabels()
        const label = labels && labels[`property_${propName}`];
        if (label)
          title = label;
      }
      return title;
    }
    catch (e) {
      e.message = `invalid filterableFields config for '${propName}' - ${e.message}`;
      throw e; // rethrow.
    }
  }
  
  //construct the object of terms for advanced search
  function getTerms() {
    const vocabIDsAndInitiativeVariables = getVocabIDsAndInitiativeVariables();

    let usedTerms = {};

    let vocabLang = fallBackLanguage;

    // Set vocabLang to the configured language, if present in the first available vocab we check.
    const vocabIDs = Object.keys(vocabIDsAndInitiativeVariables);
    if (vocabIDs.length > 0) {
      const dummyVocabID = vocabIDs[0];
      if (vocabs.vocabs[dummyVocabID] && vocabs.vocabs[dummyVocabID][language]) {
        vocabLang = language;
      }
    }
    
    for (const vocabID in vocabIDsAndInitiativeVariables) {
      const vocabTitle = vocabs.vocabs[vocabID][vocabLang].title;
      usedTerms[vocabTitle] = {};
    }

    for (const initiativeUid in initiativesByUid) {
      const initiative = initiativesByUid[initiativeUid];

      for (const vocabID in vocabIDsAndInitiativeVariables) {
        const vocabTitle = vocabs.vocabs[vocabID][vocabLang].title;
        const propName = vocabIDsAndInitiativeVariables[vocabID];
        const id = initiative[propName];
        const propDef = classSchema.find(p => p.propertyName === propName);
        if (!propDef) console.warn(`couldn't find a property called '${propName}'`);

        // Currently still keeping the output data strucutre the same, so use id not term
        if (!usedTerms[vocabTitle][id] && id)
          usedTerms[vocabTitle][id] = vocabs.vocabs[vocabID][vocabLang].terms[id];
      }
    }

    return usedTerms;
  }

  //get an array of possible filters from  a list of initiatives
  function getPossibleFilterValues(filteredInitiatives) {
    let possibleFilterValues = [];

    const vocabIDsAndInitiativeVariables = getVocabIDsAndInitiativeVariables();

    filteredInitiatives.forEach(initiative => {
      for (const vocabID in vocabIDsAndInitiativeVariables) {
        let termIdentifier = initiative[vocabIDsAndInitiativeVariables[vocabID]];

        if (!possibleFilterValues.includes(termIdentifier))
          possibleFilterValues.push(termIdentifier);
      }
    })

    return possibleFilterValues;
  }

  function getAlternatePossibleFilterValues(filters, field) {
    //construct an array of the filters that aren't the one matching the field
    let otherFilters = [];
    filters.forEach(filter => {
      if (filter.verboseName.split(":")[0] !== field)
        otherFilters.push(filter);
    });

    //find the set of shared initiatives from the other filters
    let sharedInitiatives = [];
    otherFilters.forEach((filter, i) => {
      if (i < 1)
        sharedInitiatives = Object.values(filter.initiatives);
      else
        //loop through sharedInitiatives and remove ones without a match in filter.initiatives
        sharedInitiatives = sharedInitiatives.filter(initiative =>
          filter.initiatives.includes(initiative)
        );
    });

    //find the initiative variable associated with the field
    const vocabID = getVocabTitlesAndVocabIDs()[field];
    const initiativeVariable = getVocabIDsAndInitiativeVariables()[vocabID];

    //loop through the initiatives and get the possible values for the initiative variable
    let alternatePossibleFilterValues = [];
    sharedInitiatives.forEach(initiative => {
      alternatePossibleFilterValues.push(initiative[initiativeVariable])
    })

    return alternatePossibleFilterValues;
  }

  function getFunctionalLabels() {
    const labelLang = functionalLabels[language] ? language : fallBackLanguage;
    return functionalLabels[labelLang];
  }

  function getSidebarButtonColour() {
    return config.getSidebarButtonColour();
  }


  return {
    loadFromWebService,
    setVocab,
    addInitiatives,
    finishInitiativeLoad,
    search,
    latLngBounds,
    getRegisteredValues,
    getAllRegisteredValues,
    getInitiativeByUniqueId,
    filterDatabases,
    getAllDatasets: getDatasets,
    reset,
    getCurrentDatasets,
    getLoadedInitiatives,
    getInitiativeUIDMap,
    getDialogueSize,
    getVerboseValuesForFields,
    getLocalisedVocabs,
    getVocabIDsAndInitiativeVariables,
    getVocabTitlesAndVocabIDs,
    getTerms,
    getPossibleFilterValues,
    getAlternatePossibleFilterValues,
    getVocabTerm,
    getPropertySchema,
    getFunctionalLabels,
    getSidebarButtonColour
  };
}
// Automatically load the data when the app is ready:
//eventbus.subscribe({topic: "Main.ready", callback: loadFromWebService});
module.exports = init;
