import { Initiative } from "./app/model/initiative";
import { EventBus } from "./eventbus";
import { PhraseBook } from "./localisations";
import { Stack } from "./stack";

export interface SearchFilter {
  propName: string;
  propValue: unknown;
}

/// Represents a search result on the sidebar contentStack
export class SearchResults { 
  readonly searchString: string;
  
  constructor(readonly initiatives: Initiative[],
              readonly searchedFor: string,
              readonly filters: SearchFilter[],
              labels: PhraseBook) {
    if (filters.length > 0) {
      const filterVerboseNames = filters.map(f => `${f.propName}: ${f.propValue}`); // FIXME temporarily not localised!
      this.searchString =
        `"${searchedFor}" ${labels.in} ${filterVerboseNames.join(' '+labels.and+' ')}`;
    }
    else {
      this.searchString = `"${searchedFor}"`;
    }
  }
}


/// A stack which represents the state of the map
export class StateStack extends Stack<SearchResults> {
}
