// Model for SSE Initiatives.
import { toError } from '../../to-error';
import { toString as _toString } from '../../utils';
import type { Dictionary, Box2d } from '../../common-types';
import type { Config } from './config';
import { EventBus } from '../../eventbus';
import { toNumber } from '../../utils';
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
  VocabIndex,
  VocabServices,
  VocabAggregator,
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
import { isIso6391Code, Iso6391Code, PhraseBook, PhraseBooks } from '../../localisations';

// These used to be require()s of the relevant PHP files, but that was
// intermittently causing webpack/typescript building issues. So it
// seems simpler and more direct to just insert the string manually!
const getDatasetPhp = './services/get_dataset.php';
const getVocabsPhp  = './services/get_vocabs.php';


export interface DataLoaderMeta<T> {
  type: string;
  label: string;
  loader: DataLoader<T>; // Subtypes of loaders can expose metadata under .meta
};
export type DataLoaderMap<T> = Dictionary<DataLoaderMeta<T>>;

export type PropSourceId = string;

// Shared properties of all PropDefs.
export interface CommonPropDef {
  // Which InitiativeObj property to initialise this Initiative property from.
  // If not set, defaults to the one with the same name.
  from?: string;

  // What to call this property in the UI.
  //
  // Should be an existing (possibly abbreviated) vocab URI - the
  // corresponding localised term will be used as the title.
  //
  // If undefined, the title defaults to the property's localised
  // vocab title (if the property *is* a vocab field). Otherwise, the
  // property ID is used verbatim, as a fallback. Note that a vocab
  // title is *not* a good choice if more than one field shares the
  // same vocab!
  titleUri?: string;
}

// InnerDefs define value constraints, but not PropDef-related fields.
// This is so that a MultiPropDef can wrap the value constrains without
// duplicating the PropDef fields redundantly.
export type InnerDef = InnerValueDef | InnerVocabDef | InnerCustomDef | InnerMultiDef ;
export type InnerValueDef = {
  type: 'value';
  as?: 'string'|'boolean'|'number';
  strict?: boolean;
}
export type InnerVocabDef = {
  type: 'vocab';
  uri: string;
}
export type InnerCustomDef = {
  type: 'custom'
  builder: (id: string, def: CustomPropDef, params: InitiativeObj) => unknown;
}
export type InnerMultiDef = {
  type: 'multi';
  of: InnerDef;
}

// PropDefs define properties of Initiatives and how they map from InitiativeObj
export type PropDef = ValuePropDef | VocabPropDef | CustomPropDef | MultiPropDef ;
export type ValuePropDef = CommonPropDef & {
  type: 'value';
  as?: 'string'|'boolean'|'number';
  strict?: boolean;
}
export type VocabPropDef = CommonPropDef & {
  type: 'vocab';
  uri: string;
}
export type CustomPropDef = CommonPropDef & {
  type: 'custom'
  builder: (id: string, def: CustomPropDef, params: InitiativeObj) => unknown;
}
export type MultiPropDef = CommonPropDef & {
  type: 'multi';
  of: InnerDef;
}

export type PropDefs = Dictionary<PropDef>;

// A convenience variation of PropDefs used in ConfigData
export type FieldDefs = Dictionary<PropDef | PropDef['type']>;

// A convenient composite PropDef variation which combines vocab and
// multi property definitions. It is essentially either a VocabPropDef
// or a MultiPropDef with an added uri field - so the uri field is
// always present at the top level.
export type AnyVocabPropDef = VocabPropDef | ( MultiPropDef & { uri: string } );

// Inserts an element into a sorted array
export function sortedInsert(element: unknown, array: unknown[]) {
  array.splice(locationOf(element, array), 0, element);
  return array;

  // Internal helper function
  function locationOf(element: any, array: any[], start: number = 0, end: number = array.length): number {
    var pivot = Math.floor(start + (end - start) / 2);
    if (end - start <= 1 || Initiative.compare(array[pivot], element) == 0) {
      //SPECIAL CASE FOR ARRAY WITH LEN = 1
      if (array.length == 1) {
        return Initiative.compare(array[0], element) == 1 ? 0 : 1;
      }
      else if
        (array.length > 1 && pivot == 0) return Initiative.compare(array[0], element) == 1 ? 0 : 1;
      else
        return pivot + 1;
    }
    
    if (Initiative.compare(array[pivot], element) > 0) {
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
  getVerboseValuesForFields(): Dictionary<Dictionary>;

  getVocabs(): VocabServices;
  
  //// non-proxies

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
  
  getPropertySchema(propName: string): PropDef | undefined;

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

/// Returns a vocab URI, given a PropDef which has one, or undefined
export function propDefToVocabUri(propDef?: PropDef): string|undefined {
  if (propDef === undefined) return undefined;
  if (propDef.type === 'vocab') return propDef.uri;
  if (propDef.type === 'multi' && propDef.of.type === 'vocab') return propDef.of.uri;
  return undefined;
}

/// Predicate for testing if a PropDef has a vocab URI
export function isVocabPropDef(propDef?: PropDef): propDef is VocabPropDef|MultiPropDef {
  return !!propDefToVocabUri(propDef);
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
  
  getPropertySchema(propName: string): PropDef | undefined {
    return this.propertySchema[propName];
  }

  getVocabs(): VocabServices {
    if (!this.vocabs)
      throw new Error(`DataServices.getVocabs() used but vocabs not yet set!`);
    return this.vocabs;
  }

  getSidebarButtonColour(): string {
    return this.config.getSidebarButtonColour();
  }

  getVerboseValuesForFields(): Dictionary<Dictionary> {
    return this?.vocabs?.getVerboseValuesForFields(this.getLanguage()) ?? {};
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


