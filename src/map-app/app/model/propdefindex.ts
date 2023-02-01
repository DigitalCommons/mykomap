import { Dictionary } from "../../common_types";
import { PropDef, PropDefs } from "./dataservices";
import { VocabLookup } from "./vocabs";

export class PropDefIndex {

  constructor(
    readonly propDefs: PropDefs,
    readonly getVocab: VocabLookup,
    readonly labels: Dictionary) {
  }
  
  // Gets the schema definition for a property.
  //
  // Returns a schema definition, or throws an error null if there is no such property. 
  getDef(propName: string): PropDef {
    const propDef = this.propDefs[propName];
    if (!propDef) {
      throw new Error(`unrecognised property name: '${propName}'`);
    }
    return propDef;
  }

  
  getTitle(propName: string): string {
    let title = propName; // Fallback value

    try {
      // First get the property definition (this will throw if it's not defined)
      const propDef = this.getDef(propName);

      if (propDef.type === 'vocab') {
        // Look up the title via the vocab (this may also throw)
        title = this.getVocab(propDef.uri).title;
      }
      else if (propDef.type === 'multi' && propDef.of.type === 'vocab') {
        // Look up the title via the vocab (this may also throw)
        title = this.getVocab(propDef.of.uri).title;
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
      const error: Error = e instanceof Error? e : new Error();
      error.message = `invalid filterableFields config for '${propName}' - ${e}`;
      throw error;
    }
  }

}
