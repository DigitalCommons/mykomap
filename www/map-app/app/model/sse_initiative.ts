// Model for SSE Initiatives.

import type { Dictionary, Box2d } from '../../common_types';
import type { Registry } from '../registries';
import type { Config } from './config';
import { Vocabs, VocabIndex, LocalisedVocab } from './vocabs';
import { json } from 'd3';
import { clear } from '../../common_types';

const eventbus = require('../eventbus');
const getDatasetPhp = require("../../../services/get_dataset.php");
const getVocabsPhp = require("../../../services/get_vocabs.php");
import { functionalLabels } from '../../localisations';

interface DatasetResponse {
  meta: {
    endpoint?: string;
    default_graph_uri?: string;
    query?: string;
  };
  data: InitiativeObj[];
  status?: "success";
}

class SparqlDataLoader {
  readonly maxInitiativesToLoadPerFrame = 100;
  readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }
    
  // Loads a set of initiatives
  //
  // Loading is done asynchronously in batches of `maxInitiativesToLoadPerFrame`.
  //
  // @param [String] dataset - the identifier of this dataset
  // @param [SparqlDataAggregator] aggregator - consumer for the data
  //
  // @returns a promise which resolves when all datasets are fully loaded and processed
  // by the aggregator
  async loadDatasets(datasets: Dataset[], aggregator: SparqlDataAggregator) {
    
    // Launch the dataset loaders asynchronously, obtaining an array of promises
    // for an [<id>, <data>] pair.
    // Make an index of datasetIds to expect to the relevant dataset loader promises
    let outstanding = Object.fromEntries(datasets.map(
      (ds, ix) => [ds.id, this.loadDataset(ds)]
    ));
    
    // Process the data as it arrives, in chunks    
    while(Object.keys(outstanding).length > 0) {
      try {
        const outstandingPromises = Object.values(outstanding);
        const [datasetId, dataset] = await Promise.any(outstandingPromises);
        
        // A dataset has arrived... check it off the list
        delete outstanding[datasetId];
        
        if (dataset !== undefined) { // Skip failed datasets, which will be undefined
          
          // Load initiatives in chunks, to keep the UI responsive
          while(dataset.length > 0) {
            const batch = dataset.splice(0, this.maxInitiativesToLoadPerFrame);

             // Call addInitiatives in the background, to prevent it blocking other processes.
            await (async () => aggregator.addInitiatives(batch))();
          }
          
          // Publish completion event
          eventbus.publish({ topic: "Initiative.datasetLoaded" });
        }
      }
      catch(error) {
        // All promises should succeed, even on error. Therefore this
        // shouldn't normally occur, except possibly if there are no
        // datasets.  Ignore this.
        console.debug("Unexpected exception whilst processing datasets: ", error);
      }
    }

    // Having loaded all we can, finish off
    aggregator.sortLoadedData();
  }

  // Calls this.loadDataset and handles the result, including event emission
  async loadDataset(dataset: Dataset) {
    const result: [string, InitiativeObj[]] | [string, undefined] = [dataset.id, undefined];
    try {
      const response: DatasetResponse = await this.fetchDataset(dataset);
      console.debug("loaded " + dataset.id + " data", response);

      // Record the dataset's metadata
      dataset.endpoint = response.meta.endpoint;
      dataset.dgu = response.meta.default_graph_uri;
      dataset.query = response.meta.query;

      // Return the dataset id and its data
      result[1] = response.data;
    }
    catch(error) {
      console.error("load " + dataset.id + " data failed", error);
      
      eventbus.publish({
        topic: "Initiative.loadFailed",
        data: { error: error, dataset: dataset.id }
      });

      // Return the default, a failed dataset indicator
    }
    return result;
  }
  
  // Loads the initiatives data for the given dataset (or all of them) from the server.
  //
  // The query is defined in the relevant dataset directory's `query.rq` file.
  //
  // @param dataset - the name of one of the configured datasets, or true to get all of them.
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  // The data should be an object with the properties:
  // - `data`: [Array] list of inititive definitions, each a map of field names to values
  // - `meta`: [Object] a map of the following information:
  //    - `endpoint`: [String] the SPARQL endpoint queried 
  //    - `query`: [String] the SPARQL query used
  //    - `default_graph_uri`: [String] the default graph URI for the query (which
  //       is expected to self-resolve to the dataset's index webpage)
  async fetchDataset(dataset: Dataset): Promise<DatasetResponse> {

    let service = `${getDatasetPhp}?dataset=${encodeURIComponent(dataset.id)}`;

    // Note, caching currently doesn't work correctly with multiple data sets
    // so until that's fixed, don't use it in that case.
    const numDatasets = this.config.namedDatasets().length;
    const noCache = numDatasets > 1 ? true : this.config.getNoLodCache();
    if (noCache) {
      service += "&noLodCache=true";
    }
    console.debug("fetchDataset", service);
    
    return await json(service);
  }
}

class SparqlDataAggregator {
  readonly config: Config;
  readonly propertySchema: PropDefs;
  readonly loadedInitiatives: Initiative[] = [];
  readonly initiativesByUid: Dictionary<Initiative> = {};
  readonly vocabs: Vocabs;
  readonly vocabBuilder: ParamBuilder<PropDef>;
  readonly labels: Dictionary<string>;
  // arrays of sorted values grouped by label, then by field
  readonly registeredValues: RegisteredValues = {};
  // arrays of sorted values, grouped by label
  readonly allRegisteredValues: InitiativeIndex = {};

  constructor(config: Config, propertySchema: PropDefs, vocabs: Vocabs, labels: Dictionary<string>) {
    this.config = config;
    this.propertySchema = propertySchema;
    this.vocabs = vocabs;
    this.vocabBuilder = this.mkBuilder(vocabs);
    this.labels = labels;
  }

  
  reset() {
    this.loadedInitiatives.length = 0;
    clear(this.initiativesByUid);
    clear(this.registeredValues);
    clear(this.allRegisteredValues);
  }
  
  mkBuilder(vocabs: Vocabs): ParamBuilder<PropDef> {
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
  
  onData(e: InitiativeObj) {
    // Not all initiatives have activities

    const searchedFields = this.config.getSearchedFields();
    const language = this.config.getLanguage();
    
    // If this initiative exists already, just add multi-value property values
    if (this.initiativesByUid[e.uri] !== undefined) {
      let initiative: Initiative = this.initiativesByUid[e.uri];

      // If properties with are multi-valued, add new values to the
      // initiative.  This is to handle cases where the SPARQL
      // resultset contains multple rows for a multi-value field with
      // multiple values.
      Object.entries(this.propertySchema)
        .forEach(entry => {
          const [propertyName, propDef] = entry;
          
          if (propDef.type !== 'multi')
            return; // This is not a multi-value property. Do nothing.

          // Add this new value to the multi-valued property
          const list: any[] = initiative[propertyName];
          const value = this.vocabBuilder(propertyName, propDef.of, e);
          list.push(value);

          // If it is in the searchedFields, also add it to initiative.searchstr (if present)
          if (searchedFields.includes(propertyName)) {
            const searchableValue = this.mkSearchableValue(value, propDef.of, language);

            initiative.appendSearchableValue(searchableValue);
          }
        });
      
      //update pop-up
      eventbus.publish({ topic: "Initiative.refresh", data: initiative });
      return;
    }

    const initiative = new Initiative();
    
    // Define and initialise the instance properties.
    Object.entries(this.propertySchema).forEach(entry => {
      let [propertyName, p] = entry;
      Object.defineProperty(initiative, propertyName, {
        value: this.vocabBuilder(propertyName, p, e),
        enumerable: true,
        writable: false,
      });
    });

    // loop through the filterable fields AKA properties, and register
    const filterableFields: string[] = this.config.getFilterableFields();
    filterableFields.forEach(filterable => {
      const labelKey: string = this.getTitleForProperty(filterable);

      if (labelKey in this.allRegisteredValues)
        this.insert(initiative, this.allRegisteredValues[labelKey]);
      else
        this.allRegisteredValues[labelKey] = [initiative];

      const field = initiative[filterable];
      if (field == null) {
        // This initiative has no value for `filterable`, so can't be indexed further.
        console.warn(`Initiative has no value for filter field ${filterable}: ${initiative.uri}`);
        return;
      }

      if (labelKey in this.registeredValues) {
        const values = this.registeredValues[labelKey];
        if (field in values) {
          this.insert(initiative, values[field]);
        } else {
          values[field] = [initiative];
        }
      }
      else {
        // Create the object that holds the registered values for the current
        // field if it hasn't already been created
        const values: InitiativeIndex = this.registeredValues[labelKey] = {};
        values[field] = [initiative];
      }

    });

    this.insert(initiative, this.loadedInitiatives);
    this.initiativesByUid[initiative.uri] = initiative;

    eventbus.publish({ topic: "Initiative.new", data: initiative });
  }

  addInitiatives(initiatives: InitiativeObj[]) {
    initiatives
      .forEach(elem => this.onData(elem));
  }

  insert(element: any, array: any[]) {
    array.splice(this.locationOf(element, array), 0, element);
    return array;
  }
  
  // Get a searchable value which can be added to an initiative's searchstr field
  mkSearchableValue(value: any, propDef: PropDef, language: string) {
    if (value === undefined || value === null)
      return '';

    const stringValue = String(value);
    if (propDef.type !== 'vocab')
      return stringValue;

    const term = this.vocabs.getVocabTerm(propDef.uri, stringValue, language);
    if (term === '?')
      return ''; // No term found

    return term;
  }
  
  locationOf(element: any, array: any[], start: number = 0, end: number = array.length): number {
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
      return this.locationOf(element, array, start, pivot);
    } else {
      return this.locationOf(element, array, pivot, end);
    }
  }
  
  getTitleForProperty(propName: string): string {
    let title = propName; // Fallback value

    try {
      // First get the property definition (this will throw if it's not defined)
      const propDef = this.getPropertySchema(propName);

      // If the field is a vocab field
      if (propDef.type === 'vocab') {
        // Look up the title via the vocab (this may also throw)
        title = this.vocabs.getVocabForProperty(propName, propDef, this.config.getLanguage()).title;
      }
      else {
        // Look up the title via functionalLabels, if present
        const label = this.labels[`property_${propName}`];
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
  
  // Gets the schema definition for a property.
  //
  // Returns a schema definition, or throws an error null if there is no such property. 
  getPropertySchema(propName: string): PropDef {
    const propDef = this.propertySchema[propName];
    if (!propDef) {
      throw new Error(`unrecognised property name: '${propName}'`);
    }
    return propDef;
  }

  // Sorts only the filterable fields not the initiatives they hold
  sortLoadedData() {
    // loop through the filters and sort them data, then sort the keys in order
    const filterableFields: string[] = this.config.getFilterableFields();
    filterableFields.forEach(filterable => {
      const label = this.getTitleForProperty(filterable);

      const labelValues: InitiativeIndex = this.registeredValues[label];
      if (labelValues) {
        const propDef = this.getPropertySchema(filterable);
        const sorter = propDef.type === 'vocab' ? this.sortByVocabLabel(filterable, propDef) : sortAsString;
        const ordered = Object
          .entries(labelValues)
          .sort(sorter)
        // FIXME ideally we'd sort numbers, booleans, etc. appropriately

        this.registeredValues[label] = Object.fromEntries(ordered);
      }

      // Sort entries as strings
      function sortAsString(a: [string, any], b: [string, any]): number {
        return String(a[0]).localeCompare(String(b[0]));
      }
    });
  }
  
  // Sort entries by the vocab label for the ID used as the key
  sortByVocabLabel(id: string, propDef: PropDef) {
    const vocab = this.vocabs.getVocabForProperty(id, propDef, this.config.getLanguage());
    return (a: [string, any], b: [string, any]): number => {
      const alab = vocab.terms[a[0]];
      const blab = vocab.terms[b[0]];
      return String(alab).localeCompare(String(blab));
    };
  }

  getVocabIDsAndInitiativeVariables() {
    const vocabIDsAndInitiativeVariables: Dictionary = {};
    
    // Generate the index from filterableFields in the config
    const filterableFields: string[] = this.config.getFilterableFields();
    filterableFields.forEach(filterableField => {
      const propDef = this.getPropertySchema(filterableField);      
      if (propDef.type === 'vocab')
        vocabIDsAndInitiativeVariables[propDef.uri] = filterableField;
    })
    return vocabIDsAndInitiativeVariables;
  }

  // Returns an array of sse objects whose dataset is the same as dbSource.
  // If boolean all is set to true returns all instead.
  filterDatabases(dbSource: string, all: boolean): Initiative[] {
    if (all)
      return this.loadedInitiatives;
    else {
      const up = dbSource.toUpperCase();
      return this.loadedInitiatives.filter(
        (i: Initiative) => i.dataset.toUpperCase() === up
      );
    }
  }  
}


export class Initiative {
  //  This is used for associating internal data, like map markers
  __internal: Dictionary<any> = {};
  
  [id: string]: any | undefined;
  
  hasLocation() {
    return this.lat && this.lng;
  }
  
  // Appends a searchable value to the `searchstr` property, creating it if not present.
  // Uppercasses the value first.
  appendSearchableValue(value: string) {
    if (this.searchstr === undefined)
      this.searchstr = value.toUpperCase();
    else
      this.searchstr += ' '+ value.toUpperCase();
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

export type PropDef = ValuePropDef | VocabPropDef | CustomPropDef | MultiPropDef ;

export type PropDefs = Dictionary<PropDef>;

function sortInitiatives(a: Initiative, b: Initiative) {
  return a.name.localeCompare(b.name);
}

export class SseInitiative {
  readonly config: Config;
  readonly allDatasets: string[]; // FIXME inline
  readonly fallBackLanguage: string;
  readonly verboseDatasets: DatasetMap = {};
  readonly dataLoader: SparqlDataLoader;
  readonly functionalLabels: Dictionary<Dictionary<string>>;
  // Define the properties in an initiative and how to manage them. Note, thanks to JS
  // variable hoisting semantics, we can reference initialiser functions below, if they are
  // normal functions.
  //
  // - paramName: the name of the constructor paramter property. Not necessarily unique.
  // - init: a function to initialise the property, called with this property's schema
  //   definition and a parameters object.
  // - vocabUri: a legacy look-up key in `vocabs.vocabs`, needed when the initialiser is `fromCode`.
  //
  readonly propertySchema: PropDefs = {
    uri: { type: 'value', as: 'string' },
    name: { type: 'value', as: 'string' },
    lat: { type: 'custom', builder: SseInitiative.mkLocFromParam('lat', 'manLat') },
    lng: { type: 'custom', builder: SseInitiative.mkLocFromParam('lng', 'manLng') },
    dataset: { type: 'value', as: 'string' },
    // Note: a searchstr property is also inserted to Initiatives during construction
    // Special-cased as it potentially depends on the contents all other properties.
    // (Actual list defined by config.getSearchedFields())
  };
  
  // An index of vocabulary terms in the data, obtained from get_vocabs.php
  vocabs: Vocabs | undefined = undefined;
  builder: ParamBuilder<PropDef> | undefined = undefined;
  dataAggregator: SparqlDataAggregator | undefined = undefined;
  cachedLatLon: Box2d | undefined = undefined;

  // true means all available datasets from config are loaded
  // otherwise a string to indicate which dataset is loaded
  currentDatasets: string | boolean = true;
  
  constructor(config: Config, functionalLabels: Dictionary<Dictionary<string>>) {
    this.config = config;
    this.allDatasets = config.namedDatasets();
    this.dataLoader = new SparqlDataLoader(this.config);
    this.functionalLabels = functionalLabels;
    
    {
      const fields = this.config.fields();
      for(const fieldId in fields) {
        const fieldDef = fields[fieldId];
        this.propertySchema[fieldId] = fieldDef;
      }
    }

    {
      //setup map
      const dsNamed: string[] =
        (this.config.namedDatasetsVerbose() &&
          this.config.namedDatasets().length == this.config.namedDatasetsVerbose().length) ?
        this.config.namedDatasetsVerbose()
        : [];
      
      if (dsNamed.length == this.allDatasets.length)
        this.allDatasets.forEach((x, i) => this.verboseDatasets[x] = {
          id: x, name: dsNamed[i], endpoint: '', dgu: '', query: ''
        });
      else
        this.allDatasets.forEach((x, i) => this.verboseDatasets[x] = {
          id: x, name: x, endpoint: '', dgu: '', query: ''
        });
    }

    {
      // Need to record all instances of any of the fields that are specified in the config
      // Expects an array of strings which are initiative field names.
      const filterableFields: string[] = this.config.getFilterableFields();
      if (typeof (filterableFields) !== 'object' || !(filterableFields instanceof Array))
        throw new Error(`invalid filterableFields config for 'filterableFields' - not an array`);
      if (filterableFields.findIndex(e => typeof (e) !== 'string') >= 0)
        throw new Error(`invalid filterableFields config for 'filterableFields' - contains non-strings`);
    }

    {
      // `languages`' codes are validated and normalised in the config initialisation,
      // not here, so they are available everywhere. We can be sure there is at least one,
      // it is upper-case, and weird characters are excluded.
      const languages = this.config.getLanguages();
      
      // The language to use when no matching i18n text is found for the selected one.
      this.fallBackLanguage = languages[0];
      
      // Get the configured language. As above, this should have been validated/normalised already,
      // and so never be unset (because there is a default).
      const language = this.config.getLanguage();
      console.info("using language", language);
    }
  }


  getAllRegisteredValues(): InitiativeIndex {
    if (!this.dataAggregator)
      return {}; // Data has not yet been aggregated.  Some dependencies call this early!
    return this.dataAggregator.allRegisteredValues;
  }

  getAlternatePossibleFilterValues(filters: Filter[], field: string): Initiative[] {
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
    const vocabID = this.getVocabTitlesAndVocabIDs()[field];
    const initiativeVariable = this.getVocabIDsAndInitiativeVariables()[vocabID];

    //loop through the initiatives and get the possible values for the initiative variable
    let alternatePossibleFilterValues: Initiative[] = [];
    sharedInitiatives.forEach(initiative => {
      alternatePossibleFilterValues.push(initiative[initiativeVariable])
    })

    return alternatePossibleFilterValues;
  }
  
  getCurrentDatasets(): string | boolean {
    // @returns eiter true (if all datasets are enabled) or the identifier of a the
    // currently selected dataset.
    return this.currentDatasets;
  }

  getDatasets(): DatasetMap {
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
    return this.verboseDatasets;
  }

  getDialogueSize() {
    const dialogueSize = this.config.getDialogueSize();

    if (typeof (dialogueSize) == "string")
      return JSON.parse(dialogueSize);
    else
      return dialogueSize;
  }
  
  getFunctionalLabels() {
    return this.functionalLabels[this.getLanguage()];
  }
  
  getInitiativeByUniqueId(uid: string): Initiative | undefined {
    if (!this.dataAggregator)
      return undefined; // Data has not yet been aggregated.  Some dependencies call this early!
    return this.dataAggregator.initiativesByUid[uid];
  }

  getInitiativeUIDMap(): { [id: string]: Initiative; } {
    if (!this.dataAggregator)
      return {}; // Data has not yet been aggregated.  Some dependencies call this early!
    return this.dataAggregator.initiativesByUid;
  }

  getLanguage(): string {
    return this.config.getLanguage() || this.fallBackLanguage;
  }
  
  getLoadedInitiatives(): Initiative[] {
    if (!this.dataAggregator)
      return [];  // Data has not yet been loaded.  Some dependencies call this early!
    return this.dataAggregator.loadedInitiatives;
  }

  getLocalisedVocabs(): LocalisedVocab {
    return this?.vocabs.getLocalisedVocabs(this.getLanguage());
  }
  
  //get an array of possible filters from  a list of initiatives
  getPossibleFilterValues(filteredInitiatives: Initiative[]): string[] {
    let possibleFilterValues: string[] = [];

    const vocabIDsAndInitiativeVariables = this.getVocabIDsAndInitiativeVariables();

    filteredInitiatives.forEach(initiative => {
      for (const vocabID in vocabIDsAndInitiativeVariables) {
        let termIdentifier = initiative[vocabIDsAndInitiativeVariables[vocabID]];

        if (!possibleFilterValues.includes(termIdentifier))
          possibleFilterValues.push(termIdentifier);
      }
    })

    return possibleFilterValues;
  }

  getPropertySchema(propName: string): PropDef | undefined {
    return this.propertySchema[propName];
  }
  
  getRegisteredValues(): RegisteredValues {
    if (!this.dataAggregator)
      return {}; // Data has not yet been aggregated.  Some dependencies call this early!
    return this.dataAggregator.registeredValues;
  }

  getSidebarButtonColour(): string {
    return this.config.getSidebarButtonColour();
  }

  getTerms(): Record<string, Partial<Record<string, string>>> {
    return this?.vocabs.getTerms(this.getLanguage(), this.getVocabIDsAndInitiativeVariables(),
                                 this.dataAggregator.initiativesByUid, this.propertySchema); 
  }
  
  getVerboseValuesForFields() {
    return this?.vocabs.getVerboseValuesForFields(this.getLanguage());
  }
  
  getVocabIDsAndInitiativeVariables(): Partial<Record<string, string>> {
    if (!this.dataAggregator)
      throw new Error("Can't add initiatives. Data has not yet been aggregated.");
    return this.dataAggregator.getVocabIDsAndInitiativeVariables();
  }
  
  getVocabTerm(vocabUri: string, termUri: string): string {
    return this?.vocabs.getVocabTerm(vocabUri, termUri, this.getLanguage());
  }

  getVocabTitlesAndVocabIDs(): Partial<Record<string, string>> {
    return this?.vocabs.getVocabTitlesAndVocabIDs(this.getLanguage());
  }
  
  // Kept around for API back-compat as courtesy to popup.js, remove next breaking change.
  getVocabUriForProperty(name: string): string {
    if (!this.dataAggregator)
      throw new Error("Can't add initiatives. Data has not yet been aggregated.");
    const propDef = this.dataAggregator.getPropertySchema(name);
    if (propDef.type === 'vocab')
      return propDef.uri;
    throw new Error(`property ${name} is not a vocab property`);
  }
  
  getVocabForProperty(id: string, propDef: PropDef) {
    return this?.vocabs.getVocabForProperty(id, propDef, this.getLanguage());
  }
  
  latLngBounds(initiatives: Initiative[]): Box2d {
    // @returns an a pair of lat-long pairs that define the bounding box of all the initiatives,
    // The first element is south-west, the second north east
    //
    // Careful: isNaN(null) returns false ...
    if (!initiatives && this.cachedLatLon !== undefined) {
      return this.cachedLatLon;
    }

    const lats = (initiatives || this.dataAggregator.loadedInitiatives)
                   .filter((obj: Initiative) => obj.lat !== null && !isNaN(obj.lat))
                   .map((obj: Initiative) => obj.lat);
    const lngs = (initiatives || this.dataAggregator.loadedInitiatives)
                   .filter((obj: Initiative) => obj.lng !== null && !isNaN(obj.lng))
                   .map((obj: Initiative) => obj.lng);
    const west = Math.min.apply(Math, lngs);
    const east = Math.max.apply(Math, lngs);
    const south = Math.min.apply(Math, lats);
    const north = Math.max.apply(Math, lats);

    if (!initiatives) {
      this.cachedLatLon = [[south, west], [north, east]];
    }
    return [[south, west], [north, east]];
  }

  // Loads the currently active dataset(s) and configured vocabs
  //
  // This may be all of the datasets, or just a single selected one.
  // The vocabs are always loaded.
  async loadData() {
    // Active datasets indicated internally through `currentDatasets`
    let datasets: string[] = [];

    if (this.currentDatasets === true) {
      console.log("reset: loading all datasets ", this.config.namedDatasets());
      datasets = this.config.namedDatasets();
    }
    else if (this.allDatasets.includes(this.currentDatasets as string)) {
      console.log("reset: loading dataset '" + this.currentDatasets + "'");
      datasets = [this.currentDatasets as string]
    }
    else {
      console.log("reset: no matching dataset '" + this.currentDatasets + "'");
    }

    // Load the vocabs first, then on success, load the
    // initiatives. Handlers defined below.
    try {
      const response = await this.loadVocabs();
      
      console.log("loaded vocabs", response);

      this.setVocab(response, this.getLanguage());
      const labels = this.functionalLabels[this.config.getLanguage()];
      const dataAggregator = new SparqlDataAggregator(this.config, this.propertySchema, this.vocabs, labels);
      this.dataAggregator = undefined;

      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Started loading data" }
      });
      
      await this.dataLoader.loadDatasets(
        datasets.map(id => this.verboseDatasets[id]),
        dataAggregator
      );

      this.dataAggregator = dataAggregator;
      eventbus.publish({ topic: "Initiative.complete" });
    }
    catch(error) {
      console.error("vocabs load failed", error);

      eventbus.publish({
        topic: "Vocabularies.loadFailed",
        data: { error: error }
      });
    }
  }

  // Loads the configured list of vocabs from the server.
  //
  // The list is defined in `config.json`
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  private async loadVocabs() {
    return json(getVocabsPhp, {
      method: 'POST',
      body: JSON.stringify({
        languages: [this.getLanguage()],
        vocabularies: this.config.vocabularies(),
      }),
      headers: { 'content-type': 'application/json; charset=UTF-8' },
    });
  }
  
  // Reloads the active data set (or sets)
  //
  // @param dataset - if boolean `true`, then all datasets will be loaded.
  // Otherwise, only the dataset with a matching name is loaded (if any).
  reset(dataset: string): void {
    // If the dataset is the same as that currently selected, nothing to do
    if (dataset === this.currentDatasets)
      return;

    this.dataAggregator.reset();

    //publish reset to map markers
    eventbus.publish({
      topic: "Initiative.reset",
      data: { dataset: "all" }
    });

    this.currentDatasets = dataset;
    this.loadData();
  }
  
  search(text: string): Initiative[] {
    if (!this.dataAggregator)
      return [];
    // returns an array of sse objects whose name contains the search text
    var up = text.toUpperCase();
    return this.dataAggregator.loadedInitiatives.filter(
      (i: Initiative) => i.searchstr.includes(up)
    ).sort((a: Initiative, b: Initiative) => sortInitiatives(a, b));
  }

  setVocab(data: VocabIndex, fallBackLanguage: string): void {
    this.vocabs = new Vocabs(data, fallBackLanguage);
    eventbus.publish({ topic: "Vocabularies.loaded" });
  }

  private static mkLocFromParam(from: string, overrideParam: string) {
    function isAlpha(str: string): boolean {
      if (!str) return false;

      for (let i = 0, len = str.length; i < len; i++) {
        const code = str.charCodeAt(i);
        if (!(code > 64 && code < 91) && // upper alpha (A-Z)
          !(code > 96 && code < 123)) { // lower alpha (a-z)
          return false;
        }
      }
      return true;
    }
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
}


export function init(registry: Registry): SseInitiative {
  const config = registry("config") as Config;

  return new SseInitiative(config, functionalLabels);
}

