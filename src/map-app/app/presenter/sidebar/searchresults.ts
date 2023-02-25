import { Dictionary } from "../../../common_types";
import { StackItem } from "../../../stack";
import { Initiative } from "../../model/initiative";

/// Represents a search result on the sidebar contentStack
export class SearchResults extends StackItem { 
  readonly searchedFor: string;
  readonly searchString: string;
  readonly filters: {
    filterName: string;
    verboseName: string;
  }[];
  
  constructor(initiatives: Initiative[],
              searchString: string,
              filterVerboseNames: string[],
              filterNames: string[],
              labels: Dictionary) {
    super(initiatives);
    this.searchedFor = searchString;
    this.searchString = filterVerboseNames.length > 0 ?
      "\"" + searchString + `" ${labels.in} ` + filterVerboseNames.join(` ${labels.and} `)
      : "\"" + searchString + "\"";
    this.filters = filterNames.map((filterName, index) => ({
      filterName,
      verboseName: filterVerboseNames[index]
    }));
  }
}

