import { Dictionary } from "../../common_types";
import { Initiative, sortedInsert } from "./dataservices";
import { Vocab, VocabLookup } from "./vocabs";
import { PropDefIndex } from "./propdefindex";

// Aggregates selected Initiative properties into an index
// by property title, and an index by title then by value.
//
// Titles are the human-readable names of properties (note, this means
// they may not be unique!)
export class PropertyIndexer {
 
  
  constructor(
    /// An index of property titles to property values to lists of
    /// initiatives with that property value
    readonly byTitleThenValue: Dictionary<Dictionary<Initiative[]>>,
    
    /// An index of property titles to lists of Initiatives with that
    /// property
    readonly byTitle: Dictionary<Initiative[]>,
  
    /// An index of vocab URIs (of those propNames which are
    /// vocabs) to the referencing property ID (from the
    /// propNames)
    ///
    /// FIXME is this not going to be losing information when
    /// propNames have two items with the same vocab?
    readonly propIdByVocabUri: Dictionary,
    
    private readonly propNames: string[],
    private readonly propDefs: PropDefIndex,
    private readonly getVocab: VocabLookup
  ) {}

  /// Stores this initiative and it the values of the selected properties
  /// in the indexes.
  onData(initiative: Initiative): void {

    this.propNames.forEach(propName => {
      const title: string = this.propDefs.getTitle(propName);

      // Insert the initiative in the byTitle index
      const initiatives = this.byTitle[title];
      if (initiatives)
        sortedInsert(initiative, initiatives);
      else
        this.byTitle[title] = [initiative];

      const field = initiative[propName];
      if (field == null) {
        // This initiative has no value for `propName`, so can't be indexed further.
        console.warn(`Initiative has no value for filter field ${propName}: ${initiative.uri}`);
        return;
      }

      // Insert the initiative in the byTitleThenValue index
      const values = this.byTitleThenValue[title];
      if (values) {
        const initiatives2 = values[field]
        if (initiatives2) {
          sortedInsert(initiative, initiatives2);
        } else {
          values[field] = [initiative];
        }
      }
      else {
        // Create the object that holds the registered values for the current
        // field if it hasn't already been created
        const values: Dictionary<Initiative[]> = this.byTitleThenValue[title] = {};
        values[field] = [initiative];
      }
    });
    
  }
  
  /// Loop through the filteredFields and sort the data, then sort the
  /// keys in order. Sorts only the propName fields, not the
  /// initiatives they hold.  Also populates propIdByVocabUri.
  onComplete(): void {
    
    this.propNames.forEach(propName => {
      // Populate propIdByVocabUri
      const propDef = this.propDefs.getDef(propName);
      
      if (propDef.type === 'vocab')
        this.propIdByVocabUri[propDef.uri] = propName;
      
      const title = this.propDefs.getTitle(propName);

      const titleValues = this.byTitleThenValue[title];
      if (!titleValues)
        return; // Nothing to do here... loop to next value
      
      let sorter = sortAsString; // Default for simple case
      
      if (propDef.type === 'vocab') { // But when it's a vocab...
        const vocab = this.getVocab(propDef.uri);
        sorter = sortByVocabTitle(vocab);
      }
      
      // Now we can sort the value entries.
      // FIXME ideally we'd sort numbers, booleans, etc. appropriately
      const ordered = Object
        .entries(titleValues)
        .sort(sorter);

      // Reconstitute ordered elements as an object (which preserves this order in the key order)
      this.byTitleThenValue[title] = Object.fromEntries(ordered);

      // Done - helper functions follow.
      return;
      
      // Sort entries as strings
      function sortAsString(a: [string, any], b: [string, any]): number {
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
}

