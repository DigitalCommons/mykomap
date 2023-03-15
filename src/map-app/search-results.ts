import { MapFilter } from "./app/map-ui";
import { Initiative } from "./app/model/initiative";
import { EventBus } from "./eventbus";
import { PhraseBook } from "./localisations";
import { Stack } from "./stack";

export interface SearchFilter {
  filterName: string;
  verboseName: string;
  propName: string;
  propValue: unknown;
  localisedVocabTitle: string;
  localisedTerm: string;
}

/// Represents a search result on the sidebar contentStack
export class SearchResults { 
  readonly searchString: string;
  
  constructor(readonly initiatives: Initiative[],
              readonly searchedFor: string,
              readonly filters: SearchFilter[],
              labels: PhraseBook) {
    if (filters.length > 0) {
      const filterVerboseNames = filters.map(f => f.verboseName);
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
