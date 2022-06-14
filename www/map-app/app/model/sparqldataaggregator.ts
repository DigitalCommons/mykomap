import type { Dictionary } from '../../common_types';

import type {
  DataAggregator,
} from './dataloader';

import {
  Initiative,
  InitiativeObj,
  PropDefs,
  PropDef,
  CustomPropDef,
  MultiPropDef,
  ValuePropDef,
  VocabPropDef,
  sortInitiatives,
} from './dataservices';

import {
  Config,
} from './config';

import {
  VocabServices,
} from './vocabs';

const eventbus = require('../eventbus');

export type ParamBuilder<P> = (id: string, def: P, params: InitiativeObj) => any;

export class SparqlDataAggregator implements DataAggregator {
  // An index of URIs to the initiative with that URI
  readonly initiativesByUid: Dictionary<Initiative> = {};

  // An index of property titles to property values to lists of initiatives with that property value 
  readonly registeredValues: Dictionary<Dictionary<Initiative[]>> = {};

  /// An index of property titles to lists of Initiatives with that property
  readonly allRegisteredValues: Dictionary<Initiative[]> = {};
  
  /// An list of all initiatives
  readonly loadedInitiatives: Initiative[] = [];

  // An index of vocab URIs (of those filterableFields which are vocabs) to the referencing property ID (from the filterableFields)
  // FIXME is this not going to be losing information when filterableFields have two items with the same vocab?
  readonly vocabFilteredFields: Dictionary = {};
  
  private readonly config: Config;
  private readonly propertySchema: PropDefs;
  private readonly vocabs: VocabServices;
  private readonly paramBuilder: ParamBuilder<PropDef>;
  private readonly labels: Dictionary<string>;

  constructor(config: Config, propertySchema: PropDefs, vocabs: VocabServices, labels: Dictionary<string>) {
    this.config = config;
    this.propertySchema = propertySchema;
    this.vocabs = vocabs;
    this.paramBuilder = this.mkBuilder(vocabs);
    this.labels = labels;
  }

  addBatch(initiatives: InitiativeObj[]): void {
    initiatives
      .forEach(elem => this.onData(elem));
  }
  
  // Finishes the load after all data has been seen.
  complete() {
    // Loop through the filters and sort them data, then sort the keys in order
    // Sorts only the filterable fields, not the initiatives they hold.
    // Populate vocabFilteredFields.
    const filterableFields: string[] = this.config.getFilterableFields();
    filterableFields.forEach(filterable => {
      // Populate vocabFilteredFields
      const propDef = this.getPropertySchema(filterable);
      if (propDef.type === 'vocab')
        this.vocabFilteredFields[propDef.uri] = filterable;
      
      const label = this.getTitleForProperty(filterable);

      const labelValues: Dictionary<Initiative[]> = this.registeredValues[label];
      if (labelValues) {
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
  
  private mkBuilder(vocabs: VocabServices): ParamBuilder<PropDef> {
    function buildVocab(id: string, def: VocabPropDef, params: InitiativeObj) {
      const paramName = def.from ?? id;
      const uri = params[paramName];
      if (uri) {
        if (typeof uri !== 'string')
          throw new Error(`initiative paramter '${paramName}' should be a URI (a string), but has type '${typeof uri}'`);
        return vocabs.abbrevUri(uri);
      }
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
      // Re-use other builders (which expect an InitiativeObj) by
      // substiting the InitiativeObj's array containing the multiple
      // values with each of its elements in turn. This is partly
      // historically necessary, as SPARQL data represents multiple
      // values using multiple records, and we used to consume
      // multiple records like this.
      const paramsCopy = { ...params };
      const paramName = def.of.from ?? id;

      // Enusre we are dealing with an array. Promote non-arrays into an array
      //
      // FIXME should we actually throw an error? No- not for now,
      // because the sparqldataloader cannot currently infer a
      // multivalue into an array when there is only one record, not
      // multiple. But the plan is to address this later.
      let ary: any[] = params[paramName];
      if (ary == null) { // or undefined
        ary = [];
      }
      else if (!(typeof ary === 'object' && ary instanceof Array)) {
        ary = [params[paramName]];
      }
      return ary.map(param => {
        paramsCopy[paramName] = param;
        return buildAny(id, def.of, paramsCopy);
      });
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

  // This expects complete initiaitives, with multi-valued fields
  // expressed as either single values, or an array of multiple
  // values. (Single values are historically allowed to make it easier
  // to marshall the multiple-record expression of multiple values
  // emitted by SPARQL)
  //
  // So these are equivalent:
  // - { uri: 'xxx', multivalue: 1 }
  // - { uri: 'xxx', multivalue: [1] }
  private onData(props: InitiativeObj) {
    // Not all initiatives have activities

    const searchedFields = this.config.getSearchedFields();
    const language = this.config.getLanguage();
    
    // If this initiative exists already, something is wrong!
    if (this.initiativesByUid[props.uri] !== undefined) {
      throw new Error(`duplicate initiative uri: ${props.uri}`);
    }

    const initiative = new Initiative();
    
    // Define and initialise the instance properties.
    Object.entries(this.propertySchema).forEach(entry => {
      let [propertyName, propDef] = entry;
      Object.defineProperty(initiative, propertyName, {
        value: this.paramBuilder(propertyName, propDef, props),
        enumerable: true,
        writable: false,
      });
    });

    // loop through the filterable fields AKA properties, and register
    const filterableFields: string[] = this.config.getFilterableFields();
    filterableFields.forEach(filterable => {
      const labelKey: string = this.getTitleForProperty(filterable);

      // Insert the initiative in the allRegisteredValues index
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

      // Insert the initiative in the registeredValues index
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
        const values: Dictionary<Initiative[]> = this.registeredValues[labelKey] = {};
        values[field] = [initiative];
      }

    });

    // Insert the initiative into loadedInitiatives
    this.insert(initiative, this.loadedInitiatives);

    // Insert the initiative into initiativesByUid
    this.initiativesByUid[initiative.uri] = initiative;

    // Broadcast the creation of the initiative
    eventbus.publish({ topic: "Initiative.new", data: initiative });
  }
  
  private insert(element: any, array: any[]) {
    array.splice(this.locationOf(element, array), 0, element);
    return array;
  }
  
  // Get a searchable value which can be added to an initiative's searchstr field
  private mkSearchableValue(value: any, propDef: PropDef, language: string) {
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
  
  private locationOf(element: any, array: any[], start: number = 0, end: number = array.length): number {
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
  
  private getTitleForProperty(propName: string): string {
    let title = propName; // Fallback value

    try {
      // First get the property definition (this will throw if it's not defined)
      const propDef = this.getPropertySchema(propName);

      if (propDef.type === 'vocab') {
        // Look up the title via the vocab (this may also throw)
        title = this.vocabs.getVocabForProperty(propName, propDef, this.config.getLanguage()).title;
      }
      else if (propDef.type === 'multi') {
        // Look up the title via the vocab (this may also throw)
        title = this.vocabs.getVocabForProperty(propName, propDef.of, this.config.getLanguage()).title;
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

  // Sort entries by the vocab label for the ID used as the key
  private sortByVocabLabel(id: string, propDef: PropDef) {
    const vocab = this.vocabs.getVocabForProperty(id, propDef, this.config.getLanguage());
    return (a: [string, any], b: [string, any]): number => {
      const alab = vocab.terms[a[0]];
      const blab = vocab.terms[b[0]];
      return String(alab).localeCompare(String(blab));
    };
  }

  // Returns an array of sse objects whose dataset is the same as dbSource.
  // If boolean all is set to true returns all instead.
  private filterDatabases(dbSource: string, all: boolean): Initiative[] {
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
