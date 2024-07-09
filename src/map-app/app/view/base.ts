import * as d3 from 'd3';
import { d3Selection } from './d3-utils';

export const SentryValues = {
  OPTION_UNSELECTED: "--unselected--" // For drop-downs' unselected cases
} as const;

// 'Base class' for all views:
//
// Prior to the conversion to an ES/TypeScript class, a note on this
// class ssuggsted in future to use his base for the older view
// objects - as they were created originally before this base existed.
export abstract class BaseView {
  constructor() {}
  
  // Commented out since the d3Selection type was giving this error: TS2589: Type instantiation is excessively deep and possibly infinite.
  // d3selectAndClear(selector: string): d3Selection {
  //   // adds a log for failed selectors
  //   // Clears the innerHtml, ready for re-populating using .append()
  //   var selection = d3.select(selector);
  //   if (selection.empty()) {
  //     console.log("Unexpectedly cannot find match for selector: " + selector);
  //   } else {
  //     selection.html("");
  //   }
  //   return selection;
  // }  
}
