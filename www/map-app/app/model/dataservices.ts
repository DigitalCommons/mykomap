// Model for SSE Initiatives.

import type { Dictionary, Box2d } from '../../common_types';
import type { Registry } from '../registries';
import type { Config } from './config';
import type {
  DialogueSize,
  DataSource,
} from './config_schema';

import type {
  DataConsumer,
  DataLoader,
} from './dataloader';

import {
  AggregatedData,
  DataLoaderError,
} from './dataloader';

import {
  SparqlVocabLoader,
} from './sparqlvocabloader';

import {
  Vocab,
  VocabIndex,
  VocabServices,
  VocabAggregator,
  LocalisedVocab,
  VocabServiceImpl,
  SparqlVocabResponse,
  isSparqlVocabResponse,
} from './vocabs';

import {
  SparqlDataLoader,
} from './sparqldataloader';

import {
  SparqlDataAggregator,
} from './sparqldataaggregator';

const getDatasetPhp = require("../../../services/get_dataset.php");
const getVocabsPhp  = require("../../../services/get_vocabs.php");

const eventbus = require('../eventbus');
import { functionalLabels } from '../../localisations';
import { CsvDataLoader } from './csvdataloader';

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

export interface DataLoaderMeta<T> {
  type: string;
  label: string;
  loader: DataLoader<T>; // Subtypes of loaders can expose metadata under .meta
};
type DataLoaderMap<T> = Dictionary<DataLoaderMeta<T>>;

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
  
  getVerboseValuesForFields(): Dictionary<Dictionary>;

  getVocabTerm(vocabUri: string, termUri: string): string | undefined;

  getVocabTitlesAndVocabIDs(): Dictionary;
  
  getVocabForProperty(id: string, propDef: PropDef): Vocab | undefined;
  

  //// Wraps both dataAggregator and vocabs
  
  getTerms(): Dictionary<Dictionary>;


  //// non-proxies

  getAlternatePossibleFilterValues(filters: Filter[], field: string): Initiative[];

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
  // dataAggregator and vocabs should be available on completion
  loadDatasets(datasetIds: string[]): Promise<void>;

  // Reloads the active data set (or sets)
  //
  // @param dataset - if boolean `true`, then all datasets will be loaded.
  // Otherwise, only the dataset with a matching name is loaded (if any).
  reset(dataset: string): Promise<void>;
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
  readonly fallBackLanguage: string;
  readonly datasets: DataLoaderMap<InitiativeObj> = {};
  readonly vocabLoaders: DataLoaderMap<VocabIndex> = {};
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
            // ?? FIXME
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
            this.datasets[ds.id] = {
              type: ds.type,
              label: ds.label,
              loader: new CsvDataLoader(ds.id, ds.url, ds.transform),
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
    const alternatePossibleFilterValues: Initiative[] = [];
    const vocabID = this.getVocabTitlesAndVocabIDs()[field];
    if (vocabID) {
      const initiativeVariable = this.aggregatedData.vocabFilteredFields[vocabID];

      if (initiativeVariable) {
        //loop through the initiatives and get the possible values for the initiative variable
        sharedInitiatives.forEach(initiative => {
          const prop = initiative[initiativeVariable]
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

  getFunctionalLabels(): Dictionary<string> {
    return this.functionalLabels[this.getLanguage()] ?? {};
  }
  
  getLanguage(): string {
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

    const vocabFilteredFields = this.aggregatedData.vocabFilteredFields;

    filteredInitiatives.forEach(initiative => {
      for (const vocabID in vocabFilteredFields) {
        const vff = vocabFilteredFields[vocabID]
        if (!vff)
          continue;
        let termIdentifier = initiative[vff];

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

  getTerms(): Dictionary<Dictionary> {
    if (!this.vocabs)
      return {};

    return this.vocabs.getTerms(this.getLanguage(),
                                this.aggregatedData.vocabFilteredFields,
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
      const dataLoaders = datasetIds
        .map(id => this.datasets[id]?.loader)
        .filter((ds): ds is DataLoader<InitiativeObj> => ds !== undefined)

      const onItemComplete = (initiative: Initiative) => {
        // Broadcast the creation of the initiative
        eventbus.publish({ topic: "Initiative.new", data: initiative });
      };
      const onSetComplete = (id: string) => {
        // Publish completion event
        eventbus.publish({ topic: "Initiative.datasetLoaded" });
      };
      const onSetFail = (id: string, error: Error) => {
        eventbus.publish({
          topic: "Initiative.loadFailed",
          data: { error: error, dataset: id }
        });
      };
      
      const labels = this.functionalLabels[this.config.getLanguage()] ?? {};
      if (this.vocabs === undefined)
        throw new Error("Cannot aggregate data, no vocabs available");
      const aggregator = new SparqlDataAggregator(
        this.config, this.propertySchema, this.vocabs, labels,
        onItemComplete, onSetComplete, onSetFail
      );

      eventbus.publish({
        topic: "Initiative.loadStarted",
        data: { message: "Started loading data" }
      });

      await loadDatasets(dataLoaders, aggregator);
      aggregator.allComplete(); // finish the aggregation
      
      this.aggregatedData = aggregator;
      
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

