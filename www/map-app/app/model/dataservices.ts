// Model for SSE Initiatives.

import type { Dictionary, Box2d } from '../../common_types';
import type { Registry } from '../registries';
import type { Config } from './config';
import type { DialogueSize } from './config_schema';

import type {
  Dataset,
  DataConsumer,
  DataLoader,
} from './dataloader';

import { AggregatedData } from './dataloader';

import {
  VocabServices,
  VocabIndex,
  LocalisedVocab,
  VocabServiceImpl
} from './vocabs';

import {
  SparqlDataLoader,
} from './sparqldataloader';

import {
  SparqlDataAggregator,
} from './sparqldataaggregator';

import { json } from 'd3';

const getDatasetPhp = require("../../../services/get_dataset.php");

const eventbus = require('../eventbus');
const getVocabsPhp = require("../../../services/get_vocabs.php");
import { functionalLabels } from '../../localisations';

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

interface Filter {
  filterName: string;
  verboseName: string;
  initiatives: Initiative[];
}
interface DatasetMap {
  [id: string]: Dataset;    
}
export interface InitiativeObj {
  uri: string;
  [name: string]: any;
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
  from?: string;
  builder: (id: string, def: CustomPropDef, params: InitiativeObj) => any;
}
export interface MultiPropDef {
  type: 'multi';
  of: PropDef;
  from?: string;
}

export type PropDef = ValuePropDef | VocabPropDef | CustomPropDef | MultiPropDef ;

export type PropDefs = Dictionary<PropDef>;

export function sortInitiatives(a: Initiative, b: Initiative) {
  return a.name.localeCompare(b.name);
}

// Implement the latitude/longitude fall-back logic for InitiativeObj.
//
// Creates a function which interprets a field of an InitiativeObj
// (the param in question) as a numeric latitude or longitude value
// (or undefined if this fails).  This works for string field values
// as well as numeric ones.
//
// Additionally, if manLat *and* manLng are defined in the
// InitiativeObj (and numeric or numeric strings, but not "0"), use
// the field named by overrideParam. This will typically be manLat
// or manLng, allowing these fields to override the original field,
// whatever it is.
function mkLocFromParamBuilder(from: string, overrideParam: string) {
  return (id: string, def: CustomPropDef, params: InitiativeObj) => {
    let param = params[from];

    // Overwrite with manually added lat lng if present For
    // historical reasons, "0" counts as undefined (meaning, use
    // lat/lng), cos it used to mean this in the old wonky data.
    if ('manLat' in params && params.manLat !== "0" && !isNaN(Number.parseFloat(params.manLat)) ||
      'manLng' in params && params.manLng !== "0" && !isNaN(Number.parseFloat(params.manLng))) {
      param = params[overrideParam];
    }

    // Ensure param is a number
    if (isNaN(Number.parseFloat(param)))
      return undefined;

    // Preserve undefs/nulls/empty strings as undefined 
    if (param === undefined || param === null || param === "")
      return undefined;

    return Number(param);
  };
}


// Define the properties in an initiative and how to manage them.
//
// - paramName: the name of the constructor paramter property. Not necessarily unique.
// - init: a function to initialise the property, called with this property's schema
//   definition and a parameters object.
// - vocabUri: a legacy look-up key in `vocabs.vocabs`, needed when the initialiser is `fromCode`.
//
export const basePropertySchema = Object.freeze({
  uri: {
    type: 'value',
    as: 'string',
  },
  name: {
    type: 'value',
    as: 'string',
  },
  lat: {
    type: 'custom',
    builder: mkLocFromParamBuilder('lat', 'manLat'),
  },
  lng: {
    type: 'custom',
    builder: mkLocFromParamBuilder('lng', 'manLng'),
  },
  dataset: {
    type: 'value',
    as: 'string',
  },
  // Note: a searchstr property is also inserted to Initiatives during construction
  // Special-cased as it potentially depends on the contents all other properties.
  // (Actual list defined by config.getSearchedFields())
} as PropDefs);



export interface DataServices {

  // Gets an AggregatedData value, which may be empty of data if
  // the data isn't ready yet.
  getAggregatedData(): AggregatedData;
  
  //// vocab proxies
  getLocalisedVocabs(): LocalisedVocab;
  
  getVerboseValuesForFields(): void;

  getVocabTerm(vocabUri: string, termUri: string): string;

  getVocabTitlesAndVocabIDs(): Dictionary;
  
  getVocabForProperty(id: string, propDef: PropDef): void;
  

  //// Wraps both dataAggregator and vocabs
  
  getTerms(): Record<string, Partial<Record<string, string>>>;


  //// non-proxies

  getAlternatePossibleFilterValues(filters: Filter[], field: string): Initiative[];

  // Get the current dataset, or true
  //
  // True means all available datasets from config are loaded
  // otherwise a string to indicate which dataset is loaded
  getCurrentDatasets(): string | true;

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
  getDatasets(): DatasetMap;

  getDialogueSize(): DialogueSize;

  // Gets the functional labels for the current language (obtained via getLanguage)
  getFunctionalLabels(): Dictionary<string>;

  // Gets the current language set in the config (or the fallback language if unset)
  getLanguage(): string;
  
  //get an array of possible filters from  a list of initiatives
  getPossibleFilterValues(filteredInitiatives: Initiative[]): string[];

  getPropertySchema(propName: string): PropDef | undefined;
  
  getSidebarButtonColour(): string;

  // requires dataAggregator
  latLngBounds(initiatives: Initiative[]): Box2d;

  // Loads the currently active dataset(s) and configured vocabs
  //
  // This may be all of the datasets, or just a single selected one.
  // The vocabs are always loaded.
  //
  // dataAggregator and vocabs should be available on completion
  loadData(): Promise<void>;

  // Load datasets as defined by the list given.
  //
  // Note that the dataset instances only need name and id fields set,
  // the others should be '', and will be filled in on completion.
  //
  // dataAggregator and vocabs should be available on completion
  loadDatasets(datasets: Dataset[]): Promise<void>;

  // Reloads the active data set (or sets)
  //
  // @param dataset - if boolean `true`, then all datasets will be loaded.
  // Otherwise, only the dataset with a matching name is loaded (if any).
  reset(dataset: string): Promise<void>;
}

// Implements the DataServices interface
export class DataServicesImpl implements DataServices {
  readonly config: Config;
  readonly allDatasets: string[]; // FIXME inline
  readonly fallBackLanguage: string;
  readonly verboseDatasets: DatasetMap = {};
  readonly functionalLabels: Dictionary<Dictionary<string>>;
  
  // The per-instance propert schema, which can be extended by configuration.
  readonly propertySchema: PropDefs = { ...basePropertySchema };
  
  // An index of vocabulary terms in the data, obtained from get_vocabs.php
  vocabs?: VocabServices = undefined;
  aggregatedData: AggregatedData = new AggregatedData();
  cachedLatLon?: Box2d = undefined;

  // true means all available datasets from config are loaded
  // otherwise a string to indicate which dataset is loaded
  currentDatasets: string | true = true;
  
  constructor(config: Config, functionalLabels: Dictionary<Dictionary<string>>) {
    this.config = config;
    this.allDatasets = config.namedDatasets();
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

  getAggregatedData(): AggregatedData {
    return this.aggregatedData;
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
    const initiativeVariable = this.aggregatedData.vocabFilteredFields[vocabID];

    //loop through the initiatives and get the possible values for the initiative variable
    let alternatePossibleFilterValues: Initiative[] = [];
    sharedInitiatives.forEach(initiative => {
      alternatePossibleFilterValues.push(initiative[initiativeVariable])
    })

    return alternatePossibleFilterValues;
  }
  
  getCurrentDatasets(): string | true {
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
  
  getLanguage(): string {
    return this.config.getLanguage() || this.fallBackLanguage;
  }
  
  getLocalisedVocabs(): LocalisedVocab {
    return this?.vocabs.getLocalisedVocabs(this.getLanguage());
  }
  
  //get an array of possible filters from  a list of initiatives
  getPossibleFilterValues(filteredInitiatives: Initiative[]): string[] {
    let possibleFilterValues: string[] = [];

    const vocabFilteredFields = this.aggregatedData.vocabFilteredFields;

    filteredInitiatives.forEach(initiative => {
      for (const vocabID in vocabFilteredFields) {
        let termIdentifier = initiative[vocabFilteredFields[vocabID]];

        if (!possibleFilterValues.includes(termIdentifier))
          possibleFilterValues.push(termIdentifier);
      }
    })

    return possibleFilterValues;
  }

  getPropertySchema(propName: string): PropDef | undefined {
    return this.propertySchema[propName];
  }
  
  getSidebarButtonColour(): string {
    return this.config.getSidebarButtonColour();
  }

  getTerms(): Record<string, Partial<Record<string, string>>> {
    if (!this.vocabs)
      return {};

    return this.vocabs.getTerms(this.getLanguage(),
                                this.aggregatedData.vocabFilteredFields,
                                this.aggregatedData.initiativesByUid,
                                this.propertySchema); 
  }
  
  getVerboseValuesForFields() {
    return this?.vocabs.getVerboseValuesForFields(this.getLanguage());
  }
  
  getVocabTerm(vocabUri: string, termUri: string): string {
    return this?.vocabs.getVocabTerm(vocabUri, termUri, this.getLanguage());
  }

  getVocabTitlesAndVocabIDs(): Dictionary {
    return this?.vocabs.getVocabTitlesAndVocabIDs(this.getLanguage());
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

    const lats = (initiatives || this.aggregatedData.loadedInitiatives)
                   .filter((obj: Initiative) => obj.lat !== null && !isNaN(obj.lat))
                   .map((obj: Initiative) => obj.lat);
    const lngs = (initiatives || this.aggregatedData.loadedInitiatives)
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
    let datasetNames: string[] = [];

    if (this.currentDatasets === true) {
      console.log("reset: loading all datasets ", this.config.namedDatasets());
      datasetNames = this.config.namedDatasets();
    }
    else if (this.allDatasets.includes(this.currentDatasets as string)) {
      console.log("reset: loading dataset '" + this.currentDatasets + "'");
      datasetNames = [this.currentDatasets as string]
    }
    else {
      console.log("reset: no matching dataset '" + this.currentDatasets + "'");
    }

    const datasets = datasetNames.map(id => this.verboseDatasets[id]);

    await this.loadDatasets(datasets);
  }

  // Load datasets as defined by the list given.
  //
  // Note that the dataset instances only need name and id fields set,
  // the others should be '', and will be filled in on completion.
  async loadDatasets(datasets: Dataset[]) {

    // Load the vocabs first, then on success, load the
    // initiatives. Handlers defined below.
    try {
      const response = await this.loadVocabs();
      
      console.log("loaded vocabs", response);

      this.vocabs = new VocabServiceImpl(response, this.getLanguage());
      
      eventbus.publish({ topic: "Vocabularies.loaded" });
    }
    catch(error) {
      this.vocabs = undefined;
      
      console.error("vocabs load failed", error);

      eventbus.publish({
        topic: "Vocabularies.loadFailed",
        data: { error: error }
      });
    }

    try {
      // Note, caching currently doesn't work correctly with multiple data sets
      // so until that's fixed, don't use it in that case.
      const numDatasets = this.config.namedDatasets().length;
      const noCache = numDatasets > 1 ? true : this.config.getNoLodCache();
      const dataLoader = new SparqlDataLoader(getDatasetPhp, !noCache);
      
      const labels = this.functionalLabels[this.config.getLanguage()];
      const aggregator = new SparqlDataAggregator(this.config, this.propertySchema, this.vocabs, labels);

      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Started loading data" }
      });

      const onDataset = (id: string, error?: Error) => {
        if (error) {
          eventbus.publish({
            topic: "Initiative.loadFailed",
            data: { error: error, dataset: id }
          });
        }
        else {
          // Publish completion event
          eventbus.publish({ topic: "Initiative.datasetLoaded" });
        }
      }
      this.aggregatedData = await dataLoader.loadDatasets(datasets, aggregator, onDataset);
      
      eventbus.publish({ topic: "Initiative.complete" });
    }
    catch(error) {
      this.aggregatedData = new AggregatedData();
      
      console.error("data load failed", error);

      eventbus.publish({
        topic: "Initiative.loadFailed",
        data: { error: error }
      });
    }
  }

  // Loads the configured list of vocabs from the server.
  //
  // The list is defined in `config.json`
  //
  // @return the response data wrapped in a promise, direct from d3.json.
  private async loadVocabs(): Promise<VocabIndex> {
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
  async reset(dataset: string) {
    // If the dataset is the same as that currently selected, nothing to do
    if (dataset === this.currentDatasets)
      return;

    this.aggregatedData = new AggregatedData();

    //publish reset to map markers
    eventbus.publish({
      topic: "Initiative.reset",
      data: { dataset: "all" }
    });

    this.currentDatasets = dataset;
    await this.loadData();
  }  
}


export function init(registry: Registry): DataServices {
  const config = registry("config") as Config;

  return new DataServicesImpl(config, functionalLabels);
}

