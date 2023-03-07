// Model for SSE Initiatives.
import { toError } from '../../toerror';
import type { Dictionary, Box2d } from '../../common-types';
import type { Config } from './config';
import { EventBus } from '../../eventbus';
import { toNumber, toString } from '../../utils';
import type {
  DialogueSize,
} from './config-schema';

import type {
  DataConsumer,
  DataLoader,
} from './data-loader';

import {
  AggregatedData,
  DataLoaderError,
} from './data-loader';

import {
  SparqlVocabLoader,
} from './sparql-vocab-loader';

import {
  JsonVocabLoader,
} from './json-vocab-loader';

import {
  Vocab,
  VocabIndex,
  VocabServices,
  VocabAggregator,
  LocalisedVocab,
} from './vocabs';

import {
  SparqlDataLoader,
} from './sparql-data-loader';

import {
    DataAggregator
} from './data-aggregator';

import {
  Initiative,
  InitiativeObj
} from './initiative';

import { CsvDataLoader } from './csv-data-loader';
import { isIso6391Code, Iso6391Code, ISO639_1_CODES, PhraseBook, PhraseBooks } from '../../localisations';

const getDatasetPhp = require("../../../services/get_dataset.php");
const getVocabsPhp  = require("../../../services/get_vocabs.php");


export interface DataLoaderMeta<T> {
  type: string;
  label: string;
  loader: DataLoader<T>; // Subtypes of loaders can expose metadata under .meta
};
export type DataLoaderMap<T> = Dictionary<DataLoaderMeta<T>>;

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

// A convenience variation of PropDefs used in ConfigData
export type FieldDefs = Dictionary<PropDef | PropDef['type']>;

// A convenient composite PropDef variation which combines vocab and
// multi property definitions. It is essentially either a VocabPropDef
// or a MultiPropDef with an added uri field - so the uri field is
// always present at the top level.
export type AnyVocabPropDef = VocabPropDef | ( MultiPropDef & { uri: string } );

// A dictory of AnyVocabPropDefs
export type VocabPropDefs = Dictionary<AnyVocabPropDef>;

export function sortInitiatives(a: Initiative, b: Initiative) {
  return toString(a.name).localeCompare(toString(b.name));
}

// Inserts an element into a sorted array
export function sortedInsert(element: any, array: any[]) {
  array.splice(locationOf(element, array), 0, element);
  return array;

  // Internal helper function
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
    if ('manLat' in params && params.manLat !== "0" && toNumber(params.manLat, null) !== null ||
      'manLng' in params && params.manLng !== "0" && toNumber(params.manLng, null) !== null) {
      param = params[overrideParam];
    }

    // Ensure param is a number
    param = toNumber(param, null);
    return param === null? undefined : param;
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
  
  getVerboseValuesForFields(): Dictionary<Dictionary>;

  getVocabTerm(vocabUri: string, termUri: string): string | undefined;

  getVocabTitlesAndVocabIDs(): Dictionary;
  
  getVocabForProperty(id: string, propDef: PropDef): Vocab | undefined;
  

  //// Wraps both dataAggregator and vocabs
  
  getTerms(): Dictionary<Dictionary>;


  //// non-proxies

  /// Returns a list of property values matching the given filter
  getAlternatePossibleFilterValues(filters: EventBus.Map.Filter[], field: string): unknown[];

  // Get the current dataset, or true
  //
  // True means all available datasets from config are loaded
  // otherwise a string to indicate which dataset is loaded
  getCurrentDatasets(): string | true;

  // @returns a map of dataset identifiers to dataset metadata
  //
  // This description is a map of values, which looks like:
  //
  //     { label: [String], loader: [DataLoader] }
  //
  // Where:
  //
  // - `label` is the display name for the dataset.
  // - `loader` is a dataset loader instance
  //
  getDatasets(): DataLoaderMap<InitiativeObj>;

  getDialogueSize(): DialogueSize;

  // Gets the functional labels for the current language (obtained via getLanguage)
  getFunctionalLabels(): PhraseBook;

  // Gets the current language set in the config (or the fallback language if unset)
  getLanguage(): Iso6391Code;
  
  //get an array of possible filters from  a list of initiatives
  getPossibleFilterValues(filteredInitiatives: Initiative[]): string[];

  getPropertySchema(propName: string): PropDef | undefined;

  /// Returns a VocabPropDefs index of the property schema definitions
  /// which use vocabs, keyed by their names.
  ///
  /// The values include both the propDef, and a guaranteed URI field
  /// (for convenience, since the definition can come in more than one
  /// form)
  ///
  /// If the vocabId parameter is set, these are also filtered to
  /// those using just this vocab.
  getVocabPropDefs(vocabId?: string): VocabPropDefs;
    
  getSidebarButtonColour(): string;

  // requires dataAggregator
  latLngBounds(initiatives?: Initiative[]): Box2d;

  // Loads the currently active dataset(s) and configured vocabs
  //
  // This may be all of the datasets, or just a single selected one.
  // The vocabs are always loaded.
  //
  // dataAggregator and vocabs should be available on completion
  loadData(): Promise<void>;

  // Load datasets as defined by the list given.
  //
  // dataAggregator and vocabs should be available on completion
  loadDatasets(datasetIds: string[]): Promise<void>;

  // Reloads the active data set (or sets)
  //
  // @param dataset - if boolean `true`, then all datasets will be loaded.
  // Otherwise, only the dataset with a matching name is loaded (if any).
  reset(dataset: string | true): Promise<void>;
}

// Loads zero or more datasets incrementally using the supplied dataLoaders.
//
// Data is passed to the given consumer, and its complete or fail
// methods called approriately on success or failure.
//
// @returns a promise which resolves to the consumer parameter on
// success, or an Error object on failure.
export async function loadDatasets<D, T extends DataConsumer<D>>(dataLoaders: DataLoader<D>[], consumer: T): Promise<T> {

  // Launch the dataset loaders asynchronously, obtaining an map
  // dataset ids to promises for the appropriate dataset loader
  let outstanding = Object.fromEntries(
    dataLoaders.map(ds => [ds.id, ds.load(consumer)])
  );

  // Process the data as it arrives, in chunks    
  while(Object.keys(outstanding).length > 0) {
    try {
      // Await for the next loader
      const loader = await Promise.any(Object.values(outstanding));

      // A dataset has completed
      delete outstanding[loader.id];
      consumer.complete(loader.id);
    }    
    catch(e) {
      if (e instanceof DataLoaderError) {
        console.error(`loading dataset ${e.loader.id} failed:`, e);

        delete outstanding[e.loader.id];
        consumer.fail(e.loader.id, e);
      }
      else {
        // We don't know which dataset caused an error without a
        // DataLoaderError.  In this case we must assume that the
        // outstanding promises may not get resolved, and abort
        // (otherwise one or more datasets are unresolvable and we get
        // into an infinite loop).
        
        // Ensure we have an error instance to rethrow
        const error = e instanceof Error? e : new Error();
        console.error(
          error.message =
            `loading datasets failed, no information which dataset at fault, aborting all: ${e}`
        );
        throw error;
      }
    }
  }

  return consumer;
}


// Implements the DataServices interface
export class DataServicesImpl implements DataServices {
  readonly config: Config;
  readonly fallBackLanguage: Iso6391Code;
  readonly datasets: DataLoaderMap<InitiativeObj> = {};
  readonly vocabLoaders: DataLoaderMap<VocabIndex> = {};
  readonly functionalLabels: PhraseBooks;
  
  // The per-instance propert schema, which can be extended by configuration.
  readonly propertySchema: PropDefs = { ...basePropertySchema };

  // The VocabPropDefs index
  private vocabPropDefs: VocabPropDefs;
  
  // An index of vocabulary terms in the data, obtained from get_vocabs.php
  vocabs?: VocabServices = undefined;
  aggregatedData: AggregatedData = new AggregatedData();
  cachedLatLon?: Box2d = undefined;

  // true means all available datasets from config are loaded
  // otherwise a string to indicate which dataset is loaded
  currentDatasets: string | true = true;
  
  constructor(config: Config, functionalLabels: PhraseBooks) {
    this.config = config;
    this.functionalLabels = functionalLabels;
    
    {
      const fields = this.config.fields();
      for(const fieldId in fields) {
        const fieldDef = fields[fieldId];
        this.propertySchema[fieldId] = fieldDef;
      }
    }

    {
      const vocabSources = this.config.vocabularies();
        
      vocabSources.forEach(vs => {
        switch(vs.type) {
          case 'hostSparql':
            this.vocabLoaders[vs.id] = {
              type: vs.type,
              label: vs.label,
              loader: new SparqlVocabLoader(
                vs.id,
                getVocabsPhp,
                config.getLanguages(),
                [{
                  endpoint: vs.endpoint,
                  defaultGraphUri: vs.defaultGraphUri,
                  uris: vs.uris,
                }],
              ), 
            };
            break;

          case 'json':
            const url = vs.url.match('^ */')? window.location.origin+vs.url : vs.url;
            this.vocabLoaders[vs.id] = {
              type: vs.type,
              label: vs.label,
              loader: new JsonVocabLoader(
                vs.id,
                url,
              ), 
            };
            break;

          default:
            throw new Error(`Unknown dataset type '${(vs as any)?.type}'`);
        }
      });
    }

    {
      const dataSources = this.config.getDataSources();
      
      // Note, caching is only for hostSparql datasets, but currently
      // doesn't work correctly with multiple hostSparql data sets so
      // until that's fixed, don't use it in that case.
      const numDatasets = dataSources.reduce((ix, ds) => ds.type == 'hostSparql'? ix+1 : ix, 0);
      const noCache = numDatasets > 1 ? true : this.config.getNoLodCache();

      // Build the datasources      
      dataSources.forEach((ds) => {
        switch(ds.type) {
          case 'hostSparql':
            this.datasets[ds.id] = {
              type: ds.type,
              label: ds.label,
              loader: new SparqlDataLoader(ds.id, getDatasetPhp, !noCache),
            };
            break;
          case 'csv':
            const url = ds.url.match('^ */')? window.location.origin+ds.url : ds.url;
            this.datasets[ds.id] = {
              type: ds.type,
              label: ds.label,
              loader: new CsvDataLoader(ds.id, url, ds.transform),
            };
            break;
          default:
            throw new Error(`Unknown dataset type '${(ds as any)?.type}'`);
        }
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
    
    this.vocabPropDefs = DataServicesImpl.vocabPropDefs(this.propertySchema);

    {
      // Check that all the filterable fields are property names -
      // Something is wrong if not.
      const badFields = this.config.getFilterableFields()
        .filter(name => !this.propertySchema[name]);
      
      if (badFields.length > 0) {
        throw new Error(
          `Filterable fields config must only include `+
            `names of defined properties: ${badFields.join(", ")}`
        );
      }
    }
    

  }

  getAggregatedData(): AggregatedData {
    return this.aggregatedData;
  }

  getAlternatePossibleFilterValues(filters: EventBus.Map.Filter[], field: string): unknown[] {
    //construct an array of the filters that aren't the one matching the field
    let otherFilters: EventBus.Map.Filter[] = [];
    filters.forEach(filter => {
      if (filter.verboseName?.split(":")[0] !== field)
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
    const alternatePossibleFilterValues: unknown[] = [];
    const vocabID = this.getVocabTitlesAndVocabIDs()[field];
    if (vocabID) {
      // Find the first propdef which uses this vocabID. This may not
      // be the only one!  However, this is how it was implemented
      // before, and we're only taking the first step to fixing that
      // here.
      const propEnt = Object.entries(this.vocabPropDefs)
        .find((ent): ent is [string, AnyVocabPropDef] => ent[1]?.uri === vocabID);
      if (propEnt) {
        //loop through the initiatives and get the possible values for the initiative variable
        sharedInitiatives.forEach(initiative => {
          const prop = initiative[propEnt[0]]
          if (prop !== undefined)
            alternatePossibleFilterValues.push(prop);
        })
      }
    }

    return alternatePossibleFilterValues;
  }
  
  getCurrentDatasets(): string | true {
    return this.currentDatasets;
  }

  getDatasets(): DataLoaderMap<InitiativeObj> {
    return this.datasets;
  }

  getDialogueSize() {
    const dialogueSize = this.config.getDialogueSize();

    if (typeof (dialogueSize) == "string")
      return JSON.parse(dialogueSize);
    else
      return dialogueSize;
  }

  getFunctionalLabels(): PhraseBook {
    const lang = this.getLanguage();
    const phraseBook = this.functionalLabels[lang];
    if (phraseBook)
      return phraseBook;

    const langs = Object.keys(this.functionalLabels).filter(isIso6391Code);

    // Default to first lang, if there is one! May be undefined if length == 0!
    const lang2: Iso6391Code|undefined = langs[0];
    const phraseBook2 = this.functionalLabels[lang2];
    if (phraseBook2)
      return phraseBook2;
    
    throw new Error(`no phrasebooks defined!`); // Should never happen!
  }
  
  getLanguage(): Iso6391Code {
    return this.config.getLanguage();
  }
  
  getLocalisedVocabs(): LocalisedVocab {
    if (this.vocabs)
      return this.vocabs.getLocalisedVocabs(this.getLanguage());
    return {};
  }

  //get an array of possible filters from  a list of initiatives
  getPossibleFilterValues(filteredInitiatives: Initiative[]): string[] {
    let possibleFilterValues: string[] = [];

    // Need to call this method to ensure the result is computed
    filteredInitiatives.forEach(initiative => {
      for(const name in this.config.getFilterableFields()) {    
        
        const id = initiative[name];
          
        // Add the value - if it is a vocab field and isn't already there
        if (typeof id !== 'string')
          continue;
        if (!DataServicesImpl.isVocabPropDef(this.propertySchema[id]))
          continue;
        if (!possibleFilterValues.includes(id))
          possibleFilterValues.push(id);
      }
    });

    return possibleFilterValues;
  }

  getPropertySchema(propName: string): PropDef | undefined {
    return this.propertySchema[propName];
  }

  /// Returns a vocab URI, given a PropDef which has one, or undefined
  static propDefToVocabUri(propDef?: PropDef): string|undefined {
    if (propDef === undefined) return undefined;
    if (propDef.type === 'vocab') return propDef.uri;
    if (propDef.type === 'multi' && propDef.of.type === 'vocab') return propDef.of.uri;
    return undefined;
  }

  /// Predicate for testing if a PropDef has a vocab URI
  static isVocabPropDef(propDef?: PropDef): propDef is VocabPropDef|MultiPropDef {
    return !!this.propDefToVocabUri(propDef);
  }
  
  /// Returns a VocabPropDefs index of propdefs using vocabs, keyed by their names.
  ///
  /// The values include both the propDef, and a guaranteed URI field
  /// (for convenience, since the definition can come in more than one
  /// form)
  ///
  /// If the vocabId parameter is set, these are also filtered to
  /// those using just this vocab.
  static vocabPropDefs(propDefs: PropDefs, vocabId?: string): VocabPropDefs {
    const results: VocabPropDefs = {};
    for(const name in propDefs) {
      const def = propDefs[name];
      if (!def)
        continue;

      if (def.type === 'vocab') {
        if (vocabId === undefined || def.uri === vocabId)
          results[name] = def;
      }
      if (def.type === 'multi' && def.of.type === 'vocab') {
        if (vocabId === undefined || def.of.uri === vocabId)
          results[name] = { type: 'multi', uri: def.of.uri, of: def.of };
      }
    }
    return results;
  }

  getVocabPropDefs(): VocabPropDefs {
    return this.vocabPropDefs;
  }
  
  getSidebarButtonColour(): string {
    return this.config.getSidebarButtonColour();
  }

  getTerms(): Dictionary<Dictionary> {
    if (!this.vocabs)
      return {};

    return this.vocabs.getTerms(this.getLanguage(),
                                this.aggregatedData.initiativesByUid,
                                this.propertySchema); 
  }
  
  getVerboseValuesForFields(): Dictionary<Dictionary> {
    return this?.vocabs?.getVerboseValuesForFields(this.getLanguage()) ?? {};
  }
  
  getVocabTerm(vocabUri: string, termUri: string): string | undefined {
    return this?.vocabs?.getVocabTerm(vocabUri, termUri, this.getLanguage());
  }

  getVocabTitlesAndVocabIDs(): Dictionary {
    return this?.vocabs?.getVocabTitlesAndVocabIDs(this.getLanguage()) ?? {};
  }
  
  getVocabForProperty(id: string, propDef: PropDef): Vocab | undefined {
    return this?.vocabs?.getVocabForProperty(id, propDef, this.getLanguage());
  }
  
  latLngBounds(initiatives?: Initiative[]): Box2d {
    // @returns an a pair of lat-long pairs that define the bounding box of all the initiatives,
    // The first element is south-west, the second north east
    //
    // Careful: isNaN(null) returns false ...
    if (!initiatives && this.cachedLatLon !== undefined) {
      return this.cachedLatLon;
    }

    const lats = (initiatives || this.aggregatedData.loadedInitiatives)
                   .map(obj => toNumber(obj.lat, null))
                   .filter((val): val is number => val !== null)
    const lngs = (initiatives || this.aggregatedData.loadedInitiatives)
                   .map(obj => toNumber(obj.lng, null))
                   .filter((val): val is number => val !== null)
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
    let datasetIds: string[] = [];

    if (this.currentDatasets === true) {
      datasetIds = Object.keys(this.datasets);
      console.log(`reset: loading all datasets ${datasetIds}`);
    }
    else if (this.currentDatasets in this.datasets) {
      console.log(`reset: loading dataset '${this.currentDatasets}'`);
      datasetIds = [this.currentDatasets]
    }
    else {
      console.log(`reset: no matching dataset '${this.currentDatasets}'`);
    }

    await this.loadDatasets(datasetIds);
  }

  // Load datasets as defined by the list given.
  //
  async loadDatasets(datasetIds: string[]) {

    // Load the vocabs first, then on success, load the
    // initiatives. Handlers defined below.
    try {
      await this.loadVocabs();
        
      EventBus.Vocabularies.loaded.pub();
    }
    catch(error) {
      this.vocabs = undefined;
      
      console.error("vocabs load failed", error);
      EventBus.Vocabularies.loadFailed.pub(toError(error));
    }

    try {
      const dataLoaders = datasetIds
        .map(id => this.datasets[id]?.loader)
        .filter((ds): ds is DataLoader<InitiativeObj> => ds !== undefined)

      const labels = this.functionalLabels[this.config.getLanguage()] ?? {};
      if (this.vocabs === undefined)
        throw new Error("Cannot aggregate data, no vocabs available");
      const aggregator = new DataAggregator(
        this.config, this.propertySchema, this.vocabs, labels,
        initiative => EventBus.Initiative.created.pub(initiative),
        dataset => EventBus.Initiatives.datasetLoaded.pub(dataset),
        (dataset, error) => EventBus.Initiatives.loadFailed.pub({dataset, error})
      );

      EventBus.Initiatives.loadStarted.pub();

      await loadDatasets(dataLoaders, aggregator);
      aggregator.allComplete(); // finish the aggregation
      
      this.aggregatedData = aggregator;

      EventBus.Initiatives.loadComplete.pub();
    }
    catch(error) {
      this.aggregatedData = new AggregatedData();
      
      console.error("data load failed", error);

      EventBus.Initiatives.loadFailed.pub({error: toError(error)});
    }
  }

  // Loads the configured list of vocabs from the server.
  //
  // The list is defined in the configuration.
  //
  // @return a promise which resolves when the vocabs are completely loaded
  private async loadVocabs(): Promise<void> {
    const aggregator = new VocabAggregator(this.fallBackLanguage);

    const loaders = Object.values(this.vocabLoaders)
      .filter((meta): meta is DataLoaderMeta<VocabIndex> => meta !== undefined)
      .map(meta => meta.loader)
    
    await loadDatasets<VocabIndex, VocabAggregator>(loaders, aggregator);
    this.vocabs = aggregator.allComplete(); // finish the aggregation
    return;
  }
  
  // Reloads the active data set (or sets)
  //
  // @param dataset - if boolean `true`, then all datasets will be loaded.
  // Otherwise, only the dataset with a matching name is loaded (if any).
  async reset(dataset: string | true) {
    // If the dataset is the same as that currently selected, nothing to do
    if (dataset === this.currentDatasets)
      return;

    this.aggregatedData = new AggregatedData();

    //publish reset to map markers
    EventBus.Initiatives.reset.pub();

    this.currentDatasets = dataset;
    await this.loadData();
  }  
}


