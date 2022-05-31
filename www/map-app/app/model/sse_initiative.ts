// Model for SSE Initiatives.

import type { Dictionary, Box2d } from '../../common_types';
import type { Registry } from '../registries';
import type { Config } from './config';
import { Vocabs, VocabIndex, LocalisedVocab } from './vocabs';
import { json } from 'd3';

const eventbus = require('../eventbus');
const getDatasetPhp = require("../../../services/get_dataset.php");
const getVocabsPhp = require("../../../services/get_vocabs.php");
import { functionalLabels } from '../../localisations';

class SparqlDataLoader {
  readonly maxInitiativesToLoadPerFrame = 100;
  readonly config: Config;
  readonly onData: (initiatives: InitiativeObj[]) => void;
  readonly onFinish: () => void;
  initiativesToLoad: InitiativeObj[] = [];
  loadedInitiatives: Initiative[] = [];
  startedLoading = false;
  datasetsLoaded = 0;
  datasetsToLoad = 0;

  constructor(config: Config, onData: (data: InitiativeObj[]) => void, onFinish: () => void) {
    this.config = config;
    this.onData = onData;
    this.onFinish = onFinish;
  }
  
  // Loads the initiatives data for the given dataset (or all of them) from the server.
  //
  // The query is defined in the relevant dataset directory's `query.rq` file.
  //
  // @param dataset - the name of one of the configured datasets, or true to get all of them.
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  loadDataset(dataset: Dataset) {

    let service = `${getDatasetPhp}?dataset=${encodeURIComponent(dataset.id)}`;

    // Note, caching currently doesn't work correctly with multiple data sets
    // so until that's fixed, don't use it in that case.
    const numDatasets = this.config.namedDatasets().length;
    const noCache = numDatasets > 1 ? true : this.config.getNoLodCache();
    if (noCache) {
      service += "&noLodCache=true";
    }
    console.log("loadDataset", service);
    if (!this.startedLoading) {
      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Loading data via " + service, dataset: dataset.name }
      });
      this.startedLoading = true;
    }

    return json(service);
  }


  
  // Incrementally loads the initiatives in `initiativesToLoad`, in
  // batches of `maxInitiativesToLoadPerFrame`, in the background so as to avoid
  // making the UI unresponsive. Re-invokes itself using `setTimeout` until all
  // batches are loaded.
  loadNextInitiatives() {
    // By loading the initiatives in chunks, we keep the UI responsive
    for (let i = 0; i < this.maxInitiativesToLoadPerFrame; ++i) {
      this.onData(this.initiativesToLoad.splice(0, this.maxInitiativesToLoadPerFrame));
    }
    // If there's still more to load, we do so after returning to the event loop:
    if (this.initiativesToLoad.length) {
      setTimeout(() => this.loadNextInitiatives());
    } else {
      this.finishInitiativeLoad();
    }
  }

  finishInitiativeLoad() {
    this.onFinish();
    //if more left
    this.datasetsLoaded++;
    if (this.datasetsLoaded >= this.datasetsToLoad)
      eventbus.publish({ topic: "Initiative.complete" }); //stop loading the specific dataset
  }

  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param [String] dataset - the identifier of this dataset
  // @param [Object] response - the response from get_dataset.php, a map which
  // should include the following elements:
  //
  // - `data`: [Array] list of inititive definitions, each a map of field names to values
  // - `meta`: [Object] a map of the following information:
  //    - `endpoint`: [String] the SPARQL endpoint queried 
  //    - `query`: [String] the SPARQL query used
  //    - `default_graph_uri`: [String] the default graph URI for the query (which
  //       is expected to self-resolve to the dataset's index webpage)
  //
  add(dataset: Dataset, response: any) {
    dataset.endpoint = response.meta.endpoint;
    dataset.dgu = response.meta.default_graph_uri;
    dataset.query = response.meta.query;

    this.initiativesToLoad = this.initiativesToLoad.concat(response.data);
    this.loadNextInitiatives();
  }
  
  loadInitiatives(datasets: Dataset[]) {
    datasets.forEach(dataset =>
      this.loadDataset(dataset)
        .then(this.onDatasetSuccess(dataset))
        .catch(this.onDatasetFailure(dataset))
    );
  }

  protected onDatasetSuccess(dataset: Dataset) {
    return (response: any) => {
      console.debug("loaded " + dataset.id + " data", response);
      this.add(dataset, response);
      eventbus.publish({ topic: "Initiative.datasetLoaded" });
    };
  }

  protected onDatasetFailure(dataset: Dataset) {
    return (error: string) => {
      console.error("load " + dataset.id + " data failed", error);

      eventbus.publish({
        topic: "Initiative.loadFailed",
        data: { error: error, dataset: dataset.id }
      });
    };
  }

  reset() {
    this.startedLoading = false;
    this.loadedInitiatives = [];
    this.initiativesToLoad = [];
    this.datasetsLoaded = 0;
    this.datasetsToLoad = 0;
  }
}


export class Initiative {
  //  This is used for associating internal data, like map markers
  __internal: Dictionary<any> = {};
  
  [id: string]: any | undefined;
  
  hasLocation() {
    return this.lat && this.lng;
  }

  // Appends a searchable value to the `searchstr` property, if present.
  // Uppercasses it first.
  appendSearchableValue(value: string) {
    if ('searchstr' in this) {
      if (this.searchstr === undefined)
        this.searchstr = value.toUpperCase();
      else
        this.searchstr += ' '+ value.toUpperCase();
    }
  }
}

interface InitiativeIndex {
  [id: string]: Initiative[];
}
interface RegisteredValues {
  [id: string]: InitiativeIndex;
}  
interface Filter {
  filterName: string;
  verboseName: string;
  initiatives: Initiative[];
}
interface Dataset {
  id: string;
  name: string;
  endpoint: string;
  dgu: string;
  query: string;
}
interface DatasetMap {
  [id: string]: Dataset;    
}
export interface InitiativeObj {
  uri: string;
  [name: string]: any;
}

type ParamBuilder<P> = (id: string, def: P, params: InitiativeObj) => any;

function mkBuilder(vocabs: Vocabs): ParamBuilder<PropDef> {
  function buildVocab(id: string, def: VocabPropDef, params: InitiativeObj) {
    const paramName = def.from ?? id;
    const uri = params[paramName];
    if (uri)
      return vocabs.abbrevUri(uri);
    return undefined;
  };
  function buildValue(id: string, def: ValuePropDef, params: InitiativeObj) {
    const paramName = def.from ?? id;
    const value = params[paramName];
    if (def.strict === true) {
      // Assert that the incoming type is the expected type
      switch(def.as) {
        case 'boolean': _assert(() => typeof value === 'boolean'); break;
        case 'number':  _assert(() => typeof value === 'number'); break;
        case 'string': 
        default:
          _assert(() => typeof value === 'string');
          break;
      }
      return value;
    }
    else {
      // Preserve undefined (and normalise null) values.
      if (value === undefined || value === null)
        return undefined;
      
      switch(def.as) {
        case 'boolean': return Boolean(value);
        case 'number':  return Number(value);        
        case 'string':
        default: return String(value);
      }
    } 

    function _assert(callback: () => boolean) {
      if (!callback())
        throw new Error(`Property '${id}' expects parameter '${paramName}' to be of type '${def.as}'`);
    }
  }
  //  number: (def: string) => 0,
  function buildCustom(id: string, def: CustomPropDef, params: InitiativeObj) {
    return def.builder(id, def, params);
  }
  function buildMulti(id: string, def: MultiPropDef, params: InitiativeObj): any[] {
    return [buildAny(id, def.of, params)];
  }

  
  function buildAny(id: string, def: PropDef, params: InitiativeObj): any {
    switch(def.type) {
      case 'value': return buildValue(id, def, params);
      case 'vocab': return buildVocab(id, def, params);
      case 'custom': return buildCustom(id, def, params);
      case 'multi': return buildMulti(id, def, params);
    }
  }
  return buildAny;
}

export type PropSourceId = string;


export interface ValuePropDef {
  type: 'value';
  as?: 'string'|'boolean'|'number';
  strict?: boolean;
  from?: string;
}
export interface VocabPropDef {
  type: 'vocab';
  uri: string;
  from?: string;
}
export interface CustomPropDef {
  type: 'custom'
  builder: (id: string, def: CustomPropDef, params: InitiativeObj) => any;
}
export interface MultiPropDef {
  type: 'multi';
  of: PropDef;
}

export type PropDef = ValuePropDef | VocabPropDef | CustomPropDef | MultiPropDef;

export type PropDefs = Dictionary<PropDef>;

export interface SseInitiative {
  addInitiatives: (initiatives: InitiativeObj[]) => void;
  filterDatabases: (dbSource: string, all: boolean) => Initiative[];
  getAllRegisteredValues: () => InitiativeIndex;
  getAlternatePossibleFilterValues: (filters: Filter[], field: string) => Initiative[];
  getCurrentDatasets: () => string | boolean;
  getDatasets: () => DatasetMap;
  getDialogueSize: () => any;
  getFunctionalLabels: () => any;
  getInitiativeByUniqueId: (uid: string) => Initiative;
  getInitiativeUIDMap: () => { [id: string]: Initiative; };
  getLanguage: () => string;
  getLoadedInitiatives: () => Initiative[];
  getLocalisedVocabs: () => LocalisedVocab;
  getPossibleFilterValues: (filteredInitiatives: Initiative[]) => string[];
  getPropertySchema: (propName: string) => PropDef;
  getRegisteredValues: () => RegisteredValues;
  getSidebarButtonColour: () => string;  
  getTerms: () => Record<string, Partial<Record<string, string>>>;
  getVerboseValuesForFields: () => any;
  getVocabIDsAndInitiativeVariables: () => Partial<Record<string, string>>;
  getVocabTerm: (vocabUri: string, termUri: string) => string;
  getVocabTitlesAndVocabIDs: () => Partial<Record<string, string>>;
  getVocabUriForProperty: (name: string) => string;
  latLngBounds: (initiatives: Initiative[]) => Box2d;
  loadFromWebService: () => void;
  reset: (dataset: string) => void;
  search: (text: string) => Initiative[];
  setVocab: (data: VocabIndex) => void;
//  [name: string]: unknown;
};





export function init(registry: Registry): SseInitiative {
  const config = registry("config") as Config;

  // `languages`' codes are validated and normalised in the config initialisation,
  // not here, so they are available everywhere. We can be sure there is at least one,
  // it is upper-case, and weird characters are excluded.
  const languages = config.getLanguages();

  // The language to use when no matching i18n text is found for the selected one.
  const fallBackLanguage = languages[0];

  // Get the configured language. As above, this should have been validated/normalised already,
  // and so never be unset (because there is a default).
  const language = config.getLanguage();
  console.info("using language", language);

  // Define the properties in an initiative and how to manage them. Note, thanks to JS
  // variable hoisting semantics, we can reference initialiser functions below, if they are
  // normal functions.
  //
  // - paramName: the name of the constructor paramter property. Not necessarily unique.
  // - init: a function to initialise the property, called with this property's schema
  //   definition and a parameters object.
  // - vocabUri: a legacy look-up key in `vocabs.vocabs`, needed when the initialiser is `fromCode`.
  //
  const propertySchema: PropDefs = {
    uri: { type: 'value', as: 'string' },
    name: { type: 'value', as: 'string' },
    lat: { type: 'custom', builder: mkLocFromParam('lat', 'manLat') },
    lng: { type: 'custom', builder: mkLocFromParam('lng', 'manLng') },
    searchstr: { type: 'custom', builder: mkSearchString },
    dataset: { type: 'value', as: 'string' },
  };

  const fields = config.fields();
  for(const fieldId in fields) {
    const fieldDef = fields[fieldId];
    propertySchema[fieldId] = fieldDef;
  }
  
  function mkLocFromParam(from: string, overrideParam: string) {
    return (id: string, def: CustomPropDef, params: InitiativeObj) => {
      let param = params[from];
      
      // Overwrite with manually added lat lng if present
      if (params.manLat && params.manLat != "0" ||
        params.manLng && params.manLng != "0") {
        param = params[overrideParam];
      }
    
      // Ensure param is a number
      if (isAlpha(param))
        return undefined;

      // Preserve undefs
      if (param === undefined)
        return undefined;
      
      return Number(param);
    };
  }


  // Initialiser for the search string.
  //
  // Scans the searchedFields, using the propertySchema to extract
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
  function mkSearchString(id: string, def: PropDef, params: InitiativeObj) {
    const searchedFields: string[] = config.getSearchedFields();

    const searchableValues: string[] = [];

    searchedFields.forEach(propName => {
      // Get the right schema for this field (AKA property)
      let def = propertySchema[propName];
      if (!def) {
        console.warn(`searchable field '${propName}' is not a recognised field name`)
        return;
      }

      const value = builder(propName, def, params);
      const searchableValue = mkSearchableValue(value, def, language);
      searchableValues.push(searchableValue);
    });

    // Join searchable values, squash case
    const searchStr = searchableValues.join(" ").toUpperCase();
    // console.log(params.name, "has searchstr:", searchStr); // DEBUG
    return searchStr;
  }

  const dataLoader = new SparqlDataLoader(config, addInitiatives, sortLoadedData);
  let initiativesByUid: Dictionary<Initiative> = {};
  let allDatasets: string[] = config.namedDatasets();



  //TODO: should be in a method call
  //setup map
  let verboseDatasets: DatasetMap = {}
  const dsNamed: string[] =
    (config.namedDatasetsVerbose() && config.namedDatasets().length == config.namedDatasetsVerbose().length) ?
      config.namedDatasetsVerbose()
      : [];

  // An index of vocabulary terms in the data, obtained from get_vocabs.php
  let vocabs: Vocabs | undefined = undefined;
  let builder: ParamBuilder<PropDef> | undefined = undefined;

  if (dsNamed.length == allDatasets.length)
    allDatasets.forEach((x, i) => verboseDatasets[x] = {
      id: x, name: dsNamed[i], endpoint: '', dgu: '', query: ''
    });
  else
    allDatasets.forEach((x, i) => verboseDatasets[x] = {
      id: x, name: x, endpoint: '', dgu: '', query: ''
    });



  //true means all available datasets from config are loaded
  //otherwise a string to indicate which dataset is loaded
  let currentDatasets: (string | boolean) = true;


  // Need to record all instances of any of the fields that are specified in the config
  // Expects an array of strings which are initiative field names.
  const filterableFields: string[] = config.getFilterableFields();
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

  let registeredValues: RegisteredValues = {}; // arrays of sorted values grouped by label, then by field
  let allRegisteredValues: InitiativeIndex = {}; // arrays of sorted values, grouped by label

  // Get a searchable value which can be added to an initiative's searchstr field
  function mkSearchableValue(value: any, propDef: PropDef, language: string) {
    if (value === undefined || value === null)
      return '';
    
    const stringValue = String(value);
    if (propDef.type !== 'vocab')
      return stringValue;
    
    const term = vocabs.getVocabTerm(propDef.uri, stringValue, language);
    if (term === '?')
      return ''; // No term found

    return term;
  }
  
  function mkInitiative(e: InitiativeObj) {
    // Not all initiatives have activities

    const searchedFields = config.getSearchedFields();
    
    // If this initiative exists already, just add multi-value property values
    if (initiativesByUid[e.uri] != undefined) {
      let initiative: Initiative = initiativesByUid[e.uri];

      // If properties with are multi-valued, add new values to the
      // initiative.  This is to handle cases where the SPARQL
      // resultset contains multple rows for a multi-value field with
      // multiple values.
      Object.entries(propertySchema)
        .forEach(entry => {
          const [propertyName, propDef] = entry;
          
          if (propDef.type !== 'multi')
            return; // This is not a multi-value property. Do nothing.

          // Add this new value to the multi-valued property
          const list: any[] = initiative[propertyName];
          const value = builder(propertyName, propDef.of, e);
          list.push(value);

          const searchableValue = mkSearchableValue(value, propDef.of, language);

          // If it is in the searchedFields, also add it to initiative.searchstr (if present)
          if (searchedFields.includes(propertyName)) {
            initiative.appendSearchableValue(searchableValue);
          }
        });

      //update pop-up
      eventbus.publish({ topic: "Initiative.refresh", data: initiative });
      return;
    }

    const initiative = new Initiative();
    
    // Define and initialise the instance properties.
    Object.entries(propertySchema).forEach(entry => {
      let [propertyName, p] = entry;
      Object.defineProperty(initiative, propertyName, {
        value: builder(propertyName, p, e),
        enumerable: true,
        writable: false,
      });
    });

    // loop through the filterable fields AKA properties, and register
    filterableFields.forEach(filterable => {
      const labelKey: string = getTitleForProperty(filterable);

      if (labelKey in allRegisteredValues)
        insert(initiative, allRegisteredValues[labelKey]);
      else
        allRegisteredValues[labelKey] = [initiative];

      const field = initiative[filterable];
      if (field == null) {
        // This initiative has no value for `filterable`, so can't be indexed further.
        console.warn(`Initiative has no value for filter field ${filterable}: ${initiative.uri}`);
        return;
      }

      if (labelKey in registeredValues) {
        const values = registeredValues[labelKey];
        if (field in values) {
          insert(initiative, values[field]);
        } else {
          values[field] = [initiative];
        }
      }
      else {
        // Create the object that holds the registered values for the current
        // field if it hasn't already been created
        const values: InitiativeIndex = registeredValues[labelKey] = {};
        values[field] = [initiative];
      }

    });

    insert(initiative, dataLoader.loadedInitiatives);
    initiativesByUid[initiative.uri] = initiative;

    eventbus.publish({ topic: "Initiative.new", data: initiative });

    return initiative;
  }

  function isAlpha(str: string): boolean {
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

  function sortInitiatives(a: Initiative, b: Initiative) {
    return a.name.localeCompare(b.name);
  }

  function getRegisteredValues() {
    return registeredValues;
  }
  function getAllRegisteredValues() {
    return allRegisteredValues;
  }
  function getInitiativeByUniqueId(uid: string) {
    return initiativesByUid[uid];
  }
  function getInitiativeUIDMap() {
    return initiativesByUid;
  }
  function search(text: string): Initiative[] {
    // returns an array of sse objects whose name contains the search text
    var up = text.toUpperCase();
    return dataLoader.loadedInitiatives.filter(
      (i: Initiative) => i.searchstr.includes(up)
    ).sort((a: Initiative, b: Initiative) => sortInitiatives(a, b));
  }

  function getLoadedInitiatives() {
    return dataLoader.loadedInitiatives;
  }

  function filterDatabases(dbSource: string, all: boolean) {
    // returns an array of sse objects whose dataset is the same as dbSource
    //if boolean all is set to true returns all instead
    if (all)
      return dataLoader.loadedInitiatives;
    else {
      let up = dbSource.toUpperCase();
      return dataLoader.loadedInitiatives.filter(
        (i: Initiative) => i.dataset.toUpperCase() === up
      );
    }

  }

  function getDatasets() {
    // @returns a map of dataset identifiers (from `namedDatasets`) to dataset descriptions.
    //
    // This description is a map of values, which looks like:
    //
    //     { id: [String], name: [String], endpoint: [String],
    //       dgu: [String], query: [String] }
    //
    // Where:
    //
    // - `id` is the dataset identifier (same as the key)
    // - `name` is the long name from `namedDatasetsVerbose` if available,
    //   else just the identifier is used)
    // - `query` is the SPARQL query used to obtain it
    // - `dgu` is the default graph URI used for this query
    // - `endpoint` is the SPARQL endpoint queried
    //
    return verboseDatasets;
  }

  function getCurrentDatasets() {
    // @returns eiter true (if all datasets are enabled) or the identifier of a the
    // currently selected dataset.
    return currentDatasets;
  }

  let cachedLatLon: Box2d;
  function latLngBounds(initiatives: Initiative[]): Box2d {
    // @returns an a pair of lat-long pairs that define the bounding box of all the initiatives,
    // The first element is south-west, the second north east
    //
    // Careful: isNaN(null) returns false ...
    if (!initiatives && cachedLatLon !== undefined) {
      return cachedLatLon;
    }

    const lats = (initiatives || dataLoader.loadedInitiatives)
                   .filter((obj: Initiative) => obj.lat !== null && !isNaN(obj.lat))
                   .map((obj: Initiative) => obj.lat);
    const lngs = (initiatives || dataLoader.loadedInitiatives)
                   .filter((obj: Initiative) => obj.lng !== null && !isNaN(obj.lng))
                   .map((obj: Initiative) => obj.lng);
    const west = Math.min.apply(Math, lngs);
    const east = Math.max.apply(Math, lngs);
    const south = Math.min.apply(Math, lats);
    const north = Math.max.apply(Math, lats);

    if (!initiatives) {
      cachedLatLon = [[south, west], [north, east]];
    }
    return [[south, west], [north, east]];
  }

  function addInitiatives(initiatives: InitiativeObj[]) {
    initiatives
      .forEach(elem => mkInitiative(elem));
  }

  //taken from 
  function insert(element: any, array: any[]) {
    array.splice(locationOf(element, array), 0, element);
    return array;
  }

  function locationOf(element: any, array: any[], start: number = 0, end: number = array.length): number {
    var pivot = Math.floor(start + (end - start) / 2);
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

      const labelValues: InitiativeIndex = registeredValues[label];
      if (labelValues) {
        const propDef = getPropertySchema(filterable);
        const sorter = propDef.type === 'vocab' ? sortByVocabLabel(filterable, propDef) : sortAsString;
        const ordered = Object
          .entries(labelValues)
          .sort(sorter)
        // FIXME ideally we'd sort numbers, booleans, etc. appropriately

        registeredValues[label] = Object.fromEntries(ordered);
      }

      // Sort entries by the vocab label for the ID used as the key
      function sortByVocabLabel(id: string, propDef: PropDef) {
        const vocab = getVocabForProperty(id, propDef);
        return (a: [string, any], b: [string, any]): number => {
          const alab = vocab.terms[a[0]];
          const blab = vocab.terms[b[0]];
          return String(alab).localeCompare(String(blab));
        };
      }
      // Sort entries as strings
      function sortAsString(a: [string, any], b: [string, any]): number {
        return String(a[0]).localeCompare(String(b[0]));
      }
    });

  }

  function errorMessage(response: any) {
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
  function reset(dataset: string) {
    // If the dataset is the same as that currently selected, nothing to do
    if (dataset === currentDatasets)
      return;

    dataLoader.reset();
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



  // Loads the configured list of vocabs from the server.
  //
  // The list is defined in `config.json`
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  async function loadVocabs() {
    return json(getVocabsPhp, {
      method: 'POST',
      body: JSON.stringify({
        languages: [language],
        vocabularies: config.vocabularies(),
      }),
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    });
  }


  // Loads the currently active dataset(s) and configured vocabs
  //
  // This may be all of the datasets, or just a single selected one.
  // The vocabs are always loaded.
  function loadFromWebService() {
    // Active datasets indicated internally through `currentDatasets`
    let datasets: string[] = [];

    if (currentDatasets === true) {
      console.log("reset: loading all datasets ", config.namedDatasets());
      datasets = config.namedDatasets();
    }
    else if (allDatasets.includes(currentDatasets as string)) {
      console.log("reset: loading dataset '" + currentDatasets + "'");
      datasets = [currentDatasets as string];
    }
    else {
      console.log("reset: no matching dataset '" + currentDatasets + "'");
    }

    // Load the vocabs first, then on success or failure, load the
    // initiatives. Handlers defined below.
    loadVocabs()
      .then(onVocabSuccess)
      .catch(onVocabFailure)
      .finally(() => dataLoader.loadInitiatives(datasets.map(id => verboseDatasets[id])));

    function onVocabSuccess(response: any) {
      console.log("loaded vocabs", response);

      setVocab(response, fallBackLanguage);
    }

    function onVocabFailure(error: string) {
      console.error("vocabs load failed", error);

      eventbus.publish({
        topic: "Vocabularies.loadFailed",
        data: { error: error }
      });
    }
  }

  function setVocab(data: VocabIndex, fallBackLanguage: string) {
    vocabs = new Vocabs(data, fallBackLanguage);
    builder = mkBuilder(vocabs);
    eventbus.publish({ topic: "Vocabularies.loaded" });
  }


  function getDialogueSize() {
    const dialogueSize = config.getDialogueSize();

    if (typeof (dialogueSize) == "string")
      return JSON.parse(dialogueSize);
    else
      return dialogueSize;
  }

  const getVocabIDsAndInitiativeVariables = () => {
    let vocabIDsAndInitiativeVariables: Dictionary = {};

    // Generate the index from filterableFields in the config
    filterableFields.forEach(filterableField => {
      const propDef = getPropertySchema(filterableField);      
      if (propDef.type === 'vocab')
        vocabIDsAndInitiativeVariables[propDef.uri] = filterableField;
    })
    return vocabIDsAndInitiativeVariables;
  }

  const getVerboseValuesForFields = () =>
    vocabs && vocabs.getVerboseValuesForFields(language);

  const getVocabTitlesAndVocabIDs = () =>
    vocabs && vocabs.getVocabTitlesAndVocabIDs(language);

  const getLocalisedVocabs = () =>
    vocabs && vocabs.getLocalisedVocabs(language);
  
  const getVocabTerm = (vocabUri: string, termUri: string) =>
    vocabs && vocabs.getVocabTerm(vocabUri, termUri, language);

  const getVocabUriForProperty = (name: string) => {
    const propDef = getPropertySchema(name);
    if (propDef.type === 'vocab')
      return propDef.uri;
    throw new Error(`property ${name} is not a vocab property`);
  }
  
  const getVocabForProperty = (id: string, propDef: PropDef) =>
    vocabs && vocabs.getVocabForProperty(id, propDef, language);
    
  const getTerms = () =>
    vocabs && vocabs.getTerms(language, getVocabIDsAndInitiativeVariables(), initiativesByUid, propertySchema); 
  
  // Gets the schema definition for a property.
  //
  // Returns a schema definition, or throws an error null if there is no such property. 
  function getPropertySchema(propName: string): PropDef {
    const propDef = propertySchema[propName];
    if (!propDef) {
      throw new Error(`unrecognised property name: '${propName}'`);
    }
    return propDef;
  }
  

  function getTitleForProperty(propName: string): string {
    let title = propName; // Fallback value

    try {
      // First get the property definition (this will throw if it's not defined)
      const propDef = getPropertySchema(propName);

      // If the field is a vocab field
      if (propDef.type === 'vocab') {
        // Look up the title via the vocab (this may also throw)
        title = getVocabForProperty(propName, propDef).title;
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


  //get an array of possible filters from  a list of initiatives
  function getPossibleFilterValues(filteredInitiatives: Initiative[]): string[] {
    let possibleFilterValues: string[] = [];

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

  function getAlternatePossibleFilterValues(filters: Filter[], field: string) {
    //construct an array of the filters that aren't the one matching the field
    let otherFilters: Filter[] = [];
    filters.forEach(filter => {
      if (filter.verboseName.split(":")[0] !== field)
        otherFilters.push(filter);
    });

    //find the set of shared initiatives from the other filters
    let sharedInitiatives: Initiative[] = [];
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
    let alternatePossibleFilterValues: Initiative[] = [];
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

  function getLanguage() {
    return language || fallBackLanguage;
  }

  return {
    loadFromWebService,
    setVocab,
    addInitiatives,
    search,
    latLngBounds,
    getRegisteredValues,
    getAllRegisteredValues,
    getInitiativeByUniqueId,
    filterDatabases,
    getDatasets,
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
    // Kept around for API back-compat as courtesy to popup.js, remove next breaking change.
    getVocabUriForProperty,
    getPropertySchema,
    getFunctionalLabels,
    getSidebarButtonColour,
    getLanguage
  } as SseInitiative;
}
// Automatically load the data when the app is ready:
//eventbus.subscribe({topic: "Main.ready", callback: loadFromWebService});

