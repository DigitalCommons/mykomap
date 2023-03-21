import { PropDef, PropDefs } from './data-services';
import { Dictionary } from '../../common-types';
import { toString as _toString } from '../../utils';

/// This represents an initiative represented as bare JSON
export interface InitiativeObj {
  uri: string;
  [name: string]: unknown;
}

export type ParamBuilder<P> = (id: string, params: InitiativeObj, def: P) => unknown;


/// This class represents an initiative, AKA a pin on the map.
///
/// It is somewhat dynamic - the number and type of fields is defined at runtime,
/// from a PropDefs structure, and the initialisation is defined by a ParamBuilder.
///
/// Inherently, it's basically a dictionary of enumberable, read-only
/// values of type any - but the properties are not a complete
/// free-for all - only those defined in the PropDefs structure are
/// initialilsed created.
///
/// Additionally, it has a search index property `searchstr`, which is
/// a string constructed by normalising the values of selected fields,
/// and an `__internal` property for associating arbitrary data with
/// the instance.
///
/// A constructor is created by calling mkFactory.
export class Initiative {

  /// Constructor constructor!
  ///
  /// This constructs an Initiative constructor from the given specification
  /// in propDefs (which defines the fields) and paramBuilder (which defines
  /// how to construct values for these fields).
  static mkFactory(propDefs: PropDefs,
                   paramBuilder: ParamBuilder<PropDef>,
                   searchedFields: string[]) {
    return (props: InitiativeObj) => {
      const initiative = new Initiative();

      // Define and initialise the instance properties.
      Object.entries(propDefs).forEach(entry => {
        const [propName, propDef] = entry;
        if (propDef) {
          Object.defineProperty(initiative, propName, {
            value: paramBuilder(propName, props, propDef),
            enumerable: true,
            writable: false,
          });
          if (searchedFields.includes(propName))
            appendSearchableValue(initiative, String(initiative[propName]));
        }
      });

      return initiative;
    }

    /// Appends a searchable value to the `searchstr` property, creating it if not present.
    /// Uppercasses the value first.
    function appendSearchableValue(initiative: Initiative, value: string) {
      if (initiative.searchstr === undefined)
        initiative.searchstr = value.toUpperCase();
      else
        initiative.searchstr += ' '+ value.toUpperCase();
    }
  }

  /// Compares two initiatives by a given property as a string (name, by default)
  ///
  /// If none, the empty string is used.
  static compare(a: Initiative, b: Initiative, prop: string = 'name'): number {
    return _toString(a[prop]).localeCompare(_toString(b[prop]));
  }

  /// Searches initiatives for objects whose searchstr fields include the search text
  ///
  /// @return a new list of initiatives
  static textSearch(text: string, initiatives: Initiative[]): Initiative[] {
    if (text === '') {
      return [ ...initiatives ];
    }
      
    const up = text.toUpperCase();
    return initiatives.filter(
      i => typeof i.searchstr === 'string' && i.searchstr.includes(up)
    );
  }

  // Sorts initiatives by the named field, if text
  //
  // @return a list of matching initiatives.
  static textSort(initiatives: Initiative[], prop: string = 'name'): Initiative[] {
    return [...initiatives].sort((a, b) => Initiative.compare(a, b, prop));
  }  

  // Filters initiatives by the named field
  static filter(initiatives: Initiative[], prop: string, valueRequired: unknown) {
    return initiatives.filter(
      it => it[prop] == valueRequired
    )
  }
  
  //  This is used for associating internal data, like map markers
  __internal: Dictionary<unknown> = {};

  /// Property index operator
  [id: string]: unknown | undefined;

  /// Checks if the initiative has truthy lat and lng properties.
  hasLocation(): boolean {
    return !!(this.lat && this.lng);
  }

}
