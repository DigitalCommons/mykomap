import { Dictionary } from "../../common_types";
import { Initiative, sortedInsert } from "./dataservices";
import { Vocab, VocabServices } from "./vocabs";
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
    readonly registeredValues: Dictionary<Dictionary<Initiative[]>>,
    
    /// An index of property titles to lists of Initiatives with that
    /// property
    readonly allRegisteredValues: Dictionary<Initiative[]>,
  
    /// An index of vocab URIs (of those filterableFields which are
    /// vocabs) to the referencing property ID (from the
    /// filterableFields)
    ///
    /// FIXME is this not going to be losing information when
    /// filterableFields have two items with the same vocab?
    readonly vocabFilteredFields: Dictionary,
    
    private readonly filterableFields: string[],
    private readonly propDefs: PropDefIndex,
    private readonly vocabs: VocabServices,
    private readonly language: string,
  ) {}
  
  onData(initiative: Initiative): void {

    // loop through the filterable fields AKA properties, and register
    this.filterableFields.forEach(filterable => {
      const labelKey: string = this.propDefs.getTitle(filterable);

      // Insert the initiative in the allRegisteredValues index
      const registeredInitiatives = this.allRegisteredValues[labelKey];
      if (registeredInitiatives)
        sortedInsert(initiative, registeredInitiatives);
      else
        this.allRegisteredValues[labelKey] = [initiative];

      const field = initiative[filterable];
      if (field == null) {
        // This initiative has no value for `filterable`, so can't be indexed further.
        console.warn(`Initiative has no value for filter field ${filterable}: ${initiative.uri}`);
        return;
      }

      // Insert the initiative in the registeredValues index
      const values = this.registeredValues[labelKey];
      if (values) {
        const registeredInitiatives2 = values[field]
        if (registeredInitiatives2) {
          sortedInsert(initiative, registeredInitiatives2);
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
    
  }
  
  // Loop through the filteredFields and sort the data, then sort the
  // keys in order. Sorts only the filterable fields, not the
  // initiatives they hold.  Populate vocabFilteredFields.
  onComplete(): void {
    
    this.filterableFields.forEach(propName => {
      // Populate vocabFilteredFields
      const propDef = this.propDefs.getDef(propName);
      
      if (propDef.type === 'vocab')
        this.vocabFilteredFields[propDef.uri] = propName;
      
      const label = this.propDefs.getTitle(propName);

      const labelValues = this.registeredValues[label];
      if (!labelValues)
        return; // Nothing to do here... loop to next value
      
      let sorter = sortAsString; // Default for simple case
      
      if (propDef.type === 'vocab') { // But when it's a vocab...
        const vocab = this.vocabs.getVocabForProperty(propName, propDef, this.language);
        sorter = sortByVocabLabel(vocab);
      }
      
      // Now we can sort the value entries.
      // FIXME ideally we'd sort numbers, booleans, etc. appropriately
      const ordered = Object
        .entries(labelValues)
        .sort(sorter);
      
      this.registeredValues[label] = Object.fromEntries(ordered);

      // Sort entries as strings
      function sortAsString(a: [string, any], b: [string, any]): number {
        return String(a[0]).localeCompare(String(b[0]));
      }
      // Sort entries by the vocab label for the ID used as the key
      function sortByVocabLabel(vocab: Vocab) {
        return (a: [string, any], b: [string, any]): number => {
          const alab = vocab.terms[a[0]];
          const blab = vocab.terms[b[0]];
          return String(alab).localeCompare(String(blab));
        };
      }
    });
  }
}

