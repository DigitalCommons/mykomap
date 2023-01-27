import type { Dictionary } from '../../common_types';

import type {
  DataConsumer
} from './dataloader';

import {
  AggregatedData
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
  sortedInsert,
} from './dataservices';

import {
  PropertyIndexer
} from './propertyindexer';

import {
  PropDefIndex
} from './propdefindex';

import {
  Config,
} from './config';

import {
  VocabServices,
} from './vocabs';

export type ParamBuilder<P> = (id: string, def: P, params: InitiativeObj) => any;


export class DataAggregator extends AggregatedData implements DataConsumer<InitiativeObj> {  
  private readonly paramBuilder: ParamBuilder<PropDef>;
  private readonly propIndex: PropertyIndexer;

  constructor(
    private readonly config: Config,
    private readonly propDefs: PropDefs,
    private readonly vocabs: VocabServices,
    labels: Dictionary<string>,
    public onItemComplete?: (initiative: Initiative) => void,
    public onSetComplete?: (datasetId: string) => void,
    public onSetFail?: (datasetId: string, error: Error) => void)
  {
    super();
    this.paramBuilder = this.mkBuilder(vocabs);
    this.propIndex = new PropertyIndexer(
      this.registeredValues,
      this.allRegisteredValues,
      this.vocabFilteredFields,
      config.getFilterableFields(),
      new PropDefIndex(this.propDefs, vocabs, labels, config.getLanguage()),
      this.vocabs,
      config.getLanguage()
    );
  }

  addBatch(datasetId: string, initiatives: InitiativeObj[]): void {
    initiatives
      .forEach(elem => this.onData(elem, datasetId));
  }

  complete(datasetId: string) {
    if (this.onSetComplete)
      this.onSetComplete(datasetId);
  }
  
  fail(datasetId: string, error: Error) {
    if (this.onSetFail)
      this.onSetFail(datasetId, error);
  }


  
  // Finishes the load after all data has been seen.
  allComplete() {
    this.propIndex.onComplete();
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
      // because the dataloader cannot currently infer a
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
  private onData(props: InitiativeObj, datasetId: string) {
    // Not all initiatives have activities

    const searchedFields = this.config.getSearchedFields();
    
    // If this initiative exists already, something is wrong!
    if (this.initiativesByUid[props.uri] !== undefined) {
      throw new Error(`duplicate initiative uri: ${props.uri}`);
    }

    const initiative = new Initiative();
    
    // Set the dataset id
    props.dataset = datasetId;

    // Define and initialise the instance properties.
    Object.entries(this.propDefs).forEach(entry => {
      const [propertyName, propDef] = entry;
      if (propDef) {
        Object.defineProperty(initiative, propertyName, {
          value: this.paramBuilder(propertyName, propDef, props),
          enumerable: true,
          writable: false,
        });
        if (searchedFields.includes(propertyName))
          initiative.appendSearchableValue(String(initiative[propertyName]));
      }
    });

    // Index the initiative in terms of filterableFields
    this.propIndex.onData(initiative);

    // Insert the initiative into loadedInitiatives
    sortedInsert(initiative, this.loadedInitiatives);

    // Insert the initiative into initiativesByUid
    this.initiativesByUid[initiative.uri] = initiative;

    // Report the completion
    this.onItemComplete?.(initiative);
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
