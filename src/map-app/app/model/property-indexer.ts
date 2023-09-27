import { Dictionary } from "../../common-types";
import { sortedInsert } from "./data-services";
import { Vocab, VocabLookup } from "./vocabs";
import { PropDefIndex } from "./prop-def-index";
import { Initiative } from "./initiative";

// Aggregates selected Initiative properties into an index
// by property title, and an index by title then by value.
//
// Titles are the human-readable names of properties (note, this means
// they may not be unique!)
export class PropertyIndexer {
 
  constructor(
    /// An index of property names to property values to lists of
    /// initiatives with that property value. Expected to begin empty,
    /// will be constructed.
    readonly byPropThenValue: Dictionary<Dictionary<Initiative[]>>,
    
    /// Identifiers of the properties to index
    private readonly propNames: string[],

    /// The property definitions, used to get names of properties and their values.
    private readonly propDefs: PropDefIndex,

    /// A vocab lookup (for naming vocab properties)
    private readonly getVocab: VocabLookup
  ) {
    // Sanity checks here ... ?
    // We can't check that vocabs involved are in fact defined.
    // We just have to wait and see if getVocab explodes.
  }

  /// Stores this initiative and it the values of the selected properties
  /// in the indexes.
  onData(initiative: Initiative): void {

    this.propNames.forEach(propName => {
      const value = initiative[propName];
      if (value == null) {
        // This initiative has no value for `propName`, so can't be indexed further.
        console.warn(`Initiative has no value for filter field ${propName}: ${initiative.uri}`);
        return;
      }

      const propDef = this.propDefs.getDef(propName);
      if (propDef.type === 'multi')
        // Loop over the inferred array and insert
        (value as unknown[]).forEach(v => this.insertVal(propName, v, initiative));
      else
        // Just insert the one value
        this.insertVal(propName, value, initiative);
    });
  }

  /// Loop through the filteredFields and sort the data, then sort the
  /// keys in order. Sorts only the propName fields, not the
  /// initiatives they hold.
  onComplete(): void {
    
    this.propNames.forEach(propName => {
      const propValues = this.byPropThenValue[propName];
      if (!propValues)
        return; // Nothing to do here... loop to next value
      
      let sorter = sortAsString; // Default for simple case

      const propDef = this.propDefs.getDef(propName);
      if (propDef.type === 'vocab') { // But when it's a vocab...
        const vocab = this.getVocab(propDef.uri);
        sorter = sortByVocabTitle(vocab);
      }
      
      // Now we can sort the value entries.
      // FIXME ideally we'd sort numbers, booleans, etc. appropriately
      const ordered = Object
        .entries(propValues)
        .sort(sorter);

      // Reconstitute ordered elements as an object (which preserves this order in the key order)
      this.byPropThenValue[propName] = Object.fromEntries(ordered);

      // Done - helper functions follow.
      return;
      
      // Sort entries as strings
      function sortAsString(a: [string, unknown], b: [string, unknown]): number {
        return String(a[0]).localeCompare(String(b[0]));
      }
      // Sort entries by the vocab title for the ID used as the key
      function sortByVocabTitle(vocab: Vocab) {
        return (a: [string, any], b: [string, any]): number => {
          const alab = vocab.terms[a[0]];
          const blab = vocab.terms[b[0]];
          return String(alab).localeCompare(String(blab));
        };
      }
    });
  }

  // Insert the initiative in the byPropThenValue index
  private insertVal(propName: string, value: unknown, initiative: Initiative) {
    const values = this.byPropThenValue[propName];

    // Stringify the value.
    const valueKey = value == null? "" : String(value); // defined matches null too
    
    if (values) {
      const initiatives2 = values[valueKey]
      if (initiatives2) {
        if (!initiatives2.includes(initiative)) // prevent duplicates
          sortedInsert(initiative, initiatives2);
      } else {
        values[valueKey] = [initiative];
      }
    }
    else {
      // Create the object that holds the registered values for the current
      // field if it hasn't already been created
      const values: Dictionary<Initiative[]> = this.byPropThenValue[propName] = {};
      values[valueKey] = [initiative];
    }
  }
}

