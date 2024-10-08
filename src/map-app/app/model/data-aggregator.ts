import type { Dictionary } from '../../common-types';
import { toString as _toString } from '../../utils';

import type {
  DataConsumer
} from './data-loader';

import {
  AggregatedData
} from './data-loader';

import {
  PropDefs,
  PropDef,
  CustomPropDef,
  MultiPropDef,
  ValuePropDef,
  VocabPropDef,
  sortedInsert,
} from './data-services';

import {
  PropertyIndexer
} from './property-indexer';

import {
  PropDefIndex
} from './prop-def-index';

import {
  Config,
} from './config';

import {
  VocabServices,
} from './vocabs';

import {
  Initiative,
    InitiativeObj,
    ParamBuilder
} from './initiative';
import { promoteToArray } from '../../utils';
import { TextSearch } from '../state-manager';

export class DataAggregator extends AggregatedData implements DataConsumer<InitiativeObj> {  
  private readonly paramBuilder: ParamBuilder<PropDef>;
  private readonly propIndex: PropertyIndexer;
  private readonly mkInitiative: (props: InitiativeObj) => Initiative;
  
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
      Object.keys(config.getFilteredPropDefs()),
      new PropDefIndex(this.propDefs,
                       (uri) => vocabs.getVocab(uri, config.getLanguage()),
                       labels),
      (uri: string) => this.vocabs.getVocab(uri, config.getLanguage())
    );
    const searchIndexer = this.mkSearchIndexer(config.getSearchedFields());
    this.mkInitiative = Initiative.mkFactory(this.propDefs,
                                             this.paramBuilder,
                                             searchIndexer);
  }

  mkSearchIndexer(searchedFields: string[]) {
    const getText = (value: unknown, propDef: PropDef) =>
      this.getTextForProperty(value, propDef);

    return (value: unknown, propName: string, propDef: PropDef): string|undefined => {
      if (searchedFields.includes(propName)) {
        const text = getText(value, propDef);
        if (typeof text === 'string') {
          return TextSearch.normalise(text);
        }
        else if (text instanceof Array) {
          return text.map(v => TextSearch.normalise(v)).join(' ');
        }
        else {
          return TextSearch.normalise(_toString(text));
        }
      }      
    };
  }
  

  getTextForProperty(value: unknown, propDef: PropDef): string | string[] | undefined {
    switch(propDef.type) {
      case 'value':
      case 'custom':
        // If custom, we assume it isn't a vocab or a multi
        // - FIXME custom needs refinement to clarify this, or replacement!
        return value === undefined? undefined : _toString(value);
        
      case 'vocab':
        return this?.vocabs?.getTerm(_toString(value), this.config.getLanguage());

      case 'multi':
        const innerPropDef = propDef.of;
        if (value instanceof Array)
          return value.map(v => _toString(this.getTextForProperty(v, innerPropDef)));
        return [];
    }
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
    function buildMulti(id: string, def: MultiPropDef, params: InitiativeObj): unknown[] {
      // Re-use other builders (which expect an InitiativeObj) by
      // substiting the InitiativeObj's array containing the multiple
      // values with each of its elements in turn. This is partly
      // historically necessary, as SPARQL data represents multiple
      // values using multiple records, and we used to consume
      // multiple records like this.
      const paramsCopy = { ...params };
      const paramName = def.from ?? id;

      // Enusre we are dealing with an array. Promote non-arrays into an array
      //
      // FIXME should we actually throw an error? No- not for now,
      // because the dataloader cannot currently infer a
      // multivalue into an array when there is only one record, not
      // multiple. But the plan is to address this later.
      const ary = promoteToArray(params[paramName]);
      return ary.map(param => {
        paramsCopy[paramName] = param;
        return buildAny(id, paramsCopy, def.of);
      });
    }

    function buildAny(id: string, params: InitiativeObj, def: PropDef): any {
      switch(def.type) {
        case 'value': return buildValue(id, def, params);
        case 'vocab': return buildVocab(id, def, params);
        case 'custom': return buildCustom(id, def, params);
        case 'multi': return buildMulti(id, def, params);
      }
    }
    return buildAny;
  }

  // This expects complete initiaitives, with multi-valued properties
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

    // If this initiative exists already, something is wrong!
    if (this.initiativesByUid[props.uri] !== undefined) {
      throw new Error(`duplicate initiative uri: ${props.uri}`);
    }

    // Set the dataset id
    props.dataset = datasetId;
    const initiative = this.mkInitiative(props);

    // Index the initiative in terms of filterableFields
    this.propIndex.onData(initiative);

    // Insert the initiative into loadedInitiatives
    sortedInsert(initiative, this.loadedInitiatives);

    // Insert the initiative into initiativesByUid
    const uri = initiative.uri;
    if (typeof uri !== 'string') {
      console.warn("initiative has not the mandatory uri property, ignoring", initiative);
      return;
    }

    this.initiativesByUid[uri] = initiative;

    // Report the completion
    this.onItemComplete?.(initiative);
  }
  
  // Returns an array of sse objects whose dataset is the same as dbSource.
  // If boolean all is set to true returns all instead.
  private filterDatabases(dbSource: string, all: boolean): Initiative[] {
    if (all)
      return this.loadedInitiatives;
    else {
      const up = dbSource.toUpperCase();
      return this.loadedInitiatives.filter(
        (i: Initiative) => typeof i.dataset === 'string' && i.dataset.toUpperCase() === up
      );
    }
  }  
}
