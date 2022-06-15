// Model for SSE Initiatives.

import type { Dictionary, Box2d } from '../../common_types';
import type { Registry } from '../registries';
import type { Config } from './config';

import type {
  Dataset,
  DataConsumer,
  DataLoader,
  DataAggregator,
} from './dataloader';

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

export class DataServices {
  readonly config: Config;
  readonly allDatasets: string[]; // FIXME inline
  readonly fallBackLanguage: string;
  readonly verboseDatasets: DatasetMap = {};
  readonly dataLoader: DataLoader;
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
  static readonly basePropertySchema: PropDefs = {
    uri: { type: 'value', as: 'string' },
    name: { type: 'value', as: 'string' },
    lat: { type: 'custom', builder: DataServices.mkLocFromParam('lat', 'manLat') },
    lng: { type: 'custom', builder: DataServices.mkLocFromParam('lng', 'manLng') },
    dataset: { type: 'value', as: 'string' },
    // Note: a searchstr property is also inserted to Initiatives during construction
    // Special-cased as it potentially depends on the contents all other properties.
    // (Actual list defined by config.getSearchedFields())
  };

  // The per-instance propert schema, which can be extended by configuration.
  readonly propertySchema: PropDefs = { ...DataServices.basePropertySchema };
  
  // An index of vocabulary terms in the data, obtained from get_vocabs.php
  vocabs: VocabServices | undefined = undefined;
  dataAggregator: DataAggregator | undefined = undefined;
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


  getAllRegisteredValues(): Dictionary<Initiative[]> {
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
    const initiativeVariable = this.getVocabFilteredFields()[vocabID];

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

    const vocabFilteredFields = this.getVocabFilteredFields();

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
  
  getRegisteredValues(): Dictionary<Dictionary<Initiative[]>> {
    if (!this.dataAggregator)
      return {}; // Data has not yet been aggregated.  Some dependencies call this early!
    return this.dataAggregator.registeredValues;
  }

  getSidebarButtonColour(): string {
    return this.config.getSidebarButtonColour();
  }

  getTerms(): Record<string, Partial<Record<string, string>>> {
    if (!this.dataAggregator)
      throw new Error("Can't getTerms. Data has not yet been aggregated.");
    return this?.vocabs.getTerms(this.getLanguage(),
                                 this.dataAggregator.vocabFilteredFields,
                                 this.dataAggregator.initiativesByUid,
                                 this.propertySchema); 
  }
  
  getVerboseValuesForFields() {
    return this?.vocabs.getVerboseValuesForFields(this.getLanguage());
  }
  
  getVocabFilteredFields(): Dictionary {
    if (!this.dataAggregator)
      throw new Error("Can't getVocabFilteredFields. Data has not yet been aggregated.");
    return this.dataAggregator.vocabFilteredFields;
  }
  
  getVocabTerm(vocabUri: string, termUri: string): string {
    return this?.vocabs.getVocabTerm(vocabUri, termUri, this.getLanguage());
  }

  getVocabTitlesAndVocabIDs(): Dictionary {
    return this?.vocabs.getVocabTitlesAndVocabIDs(this.getLanguage());
  }
  
  // Kept around for API back-compat as courtesy to popup.js, remove next breaking change.
  getVocabUriForProperty(name: string): string {
    if (!this.dataAggregator)
      throw new Error("Can't add initiatives. Data has not yet been aggregated.");
    const propDef = this.getPropertySchema(name);
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

      this.setVocab(response, this.getLanguage());
      const labels = this.functionalLabels[this.config.getLanguage()];
      const dataAggregator = new SparqlDataAggregator(this.config, this.propertySchema, this.vocabs, labels);
      this.dataAggregator = undefined;

      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Started loading data" }
      });
      
      await this.dataLoader.loadDatasets(
        datasets,
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
  reset(dataset: string): void {
    // If the dataset is the same as that currently selected, nothing to do
    if (dataset === this.currentDatasets)
      return;

    this.dataAggregator = undefined;

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
    this.vocabs = new VocabServiceImpl(data, fallBackLanguage);
    eventbus.publish({ topic: "Vocabularies.loaded" });
  }

  static mkLocFromParam(from: string, overrideParam: string) {
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
      
      // Overwrite with manually added lat lng if present For
      // historical reasons, "0" counts as undefined (meaning, use
      // lat/lng), cos it used to mean this in the old wonky data.
      if ('manLat' in params && params.manLat !== "0" && !isNaN(Number.parseFloat(params.manLat)) ||
        'manLng' in params && params.manLng !== "0" && !isNaN(Number.parseFloat(params.manLng))) {
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


export function init(registry: Registry): DataServices {
  const config = registry("config") as Config;

  return new DataServices(config, functionalLabels);
}

