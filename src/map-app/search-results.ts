import { Initiative } from "./app/model/initiative";
import { PhraseBook } from "./localisations";
import { StackItem } from "./stack";

export interface SearchFilter {
  filterName: string;
  verboseName: string;  
}

/// Represents a search result on the sidebar contentStack
export class SearchResults extends StackItem { 
  readonly searchedFor: string;
  readonly searchString: string;
  readonly filters: SearchFilter[];
  
  constructor(initiatives: Initiative[],
              searchString: string,
              filterVerboseNames: string[],
              filterNames: string[],
              labels: PhraseBook) {
    super(initiatives);
    this.searchedFor = searchString;
    this.searchString = filterVerboseNames.length > 0 ?
      `"${searchString}" ${labels.in} ${filterVerboseNames.join(' '+labels.and+' ')}` :
      `"${searchString}"`;
    this.filters = filterNames.map((filterName, index) => ({
      filterName,
      verboseName: filterVerboseNames[index]
    }));
  }
}
