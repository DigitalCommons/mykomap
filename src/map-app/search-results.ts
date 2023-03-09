import { Initiative } from "./app/model/initiative";
import { PhraseBook } from "./localisations";
import { Stack } from "./stack";

export interface SearchFilter {
  filterName: string;
  verboseName: string;  
}

/// Represents a search result on the sidebar contentStack
export class SearchResults { 
  readonly searchString: string;
  readonly filters: SearchFilter[];
  
  constructor(readonly initiatives: Initiative[],
              readonly searchedFor: string,
              filterVerboseNames: string[],
              filterNames: string[],
              labels: PhraseBook) {
    this.searchString = filterVerboseNames.length > 0 ?
      `"${searchedFor}" ${labels.in} ${filterVerboseNames.join(' '+labels.and+' ')}` :
      `"${searchedFor}"`;
    this.filters = filterNames.map((filterName, index) => ({
      filterName,
      verboseName: filterVerboseNames[index]
    }));
  }
}


/// A stack which represents the state of the map
export class StateStack extends Stack<SearchResults> {
}
