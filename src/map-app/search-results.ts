import { MapFilter, MapSearch } from "./app/map-ui";
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
  back(): void {
    //console.log("backButtonClicked");
    //console.log(this);
    const lastContent = this.current();
    const newContent = this.previous();
    if (!newContent || newContent == lastContent)
      return;
    
    // TODO: Think: maybe better to call a method on this that indicates thay
    //       the contentStack has been changed.
    //       Then it is up to the this to perform other actions related to this
    //       (e.g. where it affects which initiatives are selected)
    //this.view.refresh();

    EventBus.Map.removeFilters.pub();

    if(newContent instanceof SearchResults && newContent.filters[0]){    
      newContent.filters.forEach(filter=>{
        let filterData: MapFilter = {
          filterName: filter.filterName,
          result: newContent.initiatives,
          verboseName: filter.verboseName,
          propName: filter.propName,
          propValue: filter.propValue,
          localisedVocabTitle: filter.localisedVocabTitle,
          localisedTerm: filter.localisedTerm,
        };
        EventBus.Map.addFilter.pub(filterData);
      });
    }

    const data: MapSearch = {result: newContent.initiatives};
    EventBus.Map.addSearchFilter.pub(data);
  }
  
  forward(): void {
    //console.log("forwardButtonClicked");
    //console.log(this);
    const lastContent = this.current();
    const newContent = this.next();
    if (newContent == lastContent)
      return;
    //this.view.refresh();
    if(newContent && newContent instanceof SearchResults){
      EventBus.Map.removeFilters.pub();

      if(newContent.filters[0]){     
        newContent.filters.forEach(filter=>{
          let filterData: MapFilter = {
            filterName: filter.filterName,
            result: newContent.initiatives,
            verboseName: filter.verboseName,
            propName: filter.propName,
            propValue: filter.propValue,
            localisedVocabTitle: filter.localisedVocabTitle,
            localisedTerm: filter.localisedTerm,
          };
          EventBus.Map.addFilter.pub(filterData);
        });
      }

      const data: MapSearch = {result: newContent.initiatives};
      EventBus.Map.addSearchFilter.pub(data);
    }
    else{
      EventBus.Map.removeSearchFilter.pub();
    }
  }
}
