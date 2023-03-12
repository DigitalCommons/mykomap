import { Dictionary } from "../common-types";
import { Initiative } from "./model/initiative";
import { Map } from "./map";
import { MapPresenter } from "./presenter/map";
import { MarkerManager } from "./marker-manager";
import { Config } from "./model/config";
import { DataServices } from "./model/data-services";
import { EventBus } from "../eventbus";
import "./map"; // Seems to be needed to prod the leaflet CSS into loading.
import { SidebarPresenter } from "./presenter/sidebar";
import { PhraseBook } from "../localisations";
import { compactArray, toString as _toString } from '../utils';

/// Expresses a filtering operation on a FilterService<I>
export interface Filter<I> {
  filterName: string;
  verboseName: string;
  result: I[];
  localisedVocabTitle: string;
  localisedTerm: string;
}

export interface Search<I> {
  result: I[];
}

export interface Search<I> {
  result: I[];
}

export type MapFilter = Filter<Initiative>;
export type MapSearch = Search<Initiative>;

interface FilterDef<I> {
  verboseName: string;
  items: Set<I>;
  localisedTerm: string;
  localisedVocabTitle: string;
}

/// Manages a set of filtered/unfiltered items of type I
export class FilterService<I> {
  // The set of all items. Should be unchanged.
  private allItems: I[] = [];
  
  /// The set of items included for the last filter added
  private filteredIndex: Set<I> = new Set();
  /// set of items excluded for the last filter added
  private unfilteredIndex: Set<I> = new Set();

  /// An index of filter names to a list of items matched by that filter
  private filters: Dictionary<FilterDef<I>> = {};

  hidden: I[] = [];

  constructor() {
  }

  /// Resets the filter to the unfiltered state, including all the given items.
  ///
  /// Note: copies the index so that changes do not alter the original index.
  reset(items?: I[]) {
    if (items)
      this.allItems = items;
    this.filters = {};
    this.filteredIndex = new Set();
    this.unfilteredIndex = this.allItems
      .reduce<Set<I>>((ix, it) => { ix.add(it); return ix; }, new Set());
  }

  /// Gets an array of the current filtered items
  getFiltered(): I[] {
    return Array.from(this.filteredIndex);
  }

  /// Gets an array of the current unfiltered items
  getUnfiltered(): I[] {
    return Array.from(this.unfilteredIndex);
  }

  getFilterIds(): string[] {
    return Object.keys(this.filters);
  }

  getFiltersFull(): Filter<I>[] {
    const filterArray: Filter<I>[] = []
    
    for(let filterId in this.filters){
      const filter = this.filters[filterId];
      if (!filter)
        continue;
      filterArray.push({
        filterName: filterId,
        verboseName: filter.verboseName,
        result: Array.from(filter.items),
        localisedTerm: filter.localisedTerm,
        localisedVocabTitle: filter.localisedVocabTitle,
      })
    }
    
    return filterArray;
  }

  getFiltersVerbose(): string[] {
    return compactArray(Object.values(this.filters).map(f => f?.verboseName));
  }

  isFilterId(id: string): boolean {
    return !!this.filters[id];
  }

  addFilter(filter: Filter<I>): void {
    // if filter already exists don't do anything
    if (filter.filterName && this.filters[filter.filterName])
      return;

    const newFilter: FilterDef<I> = {
      items: new Set(filter.result),
      verboseName: filter.verboseName,
      localisedVocabTitle: filter.localisedVocabTitle,
      localisedTerm: filter.localisedTerm,
    };
    this.filters[filter.filterName] = newFilter;
    
    // filteredIndex should contain the union of all filters added so far.
    // At all times, filteredIndex + unfilteredIndex should equal allItems
    if (Object.keys(this.filters).length <= 1) {
      // if this is the first filter, add items to the filteredInitiativesUIDMap

      // In boolean set logic:
      // filteredIndex := items
      // unfilteredIndex := allItems ∪ ¬items [union of allItems and not items]
      
      this.unfilteredIndex = new Set(this.allItems);
      
      for(const item of filter.result) {
        this.unfilteredIndex.delete(item);
        this.filteredIndex.add(item);
      }
    }
    else {      
      // if this is the second or more filter, remove items from the
      // filteredIndex if they don't appear in the new filter's set of
      // initiatives.

      // In boolean set logic:
      // filteredIndex := filteredIndex ∩ items
      // unfilteredIndex := (filteredIndex ∩ ¬items) ∪ unfilteredIndex 

      this.filteredIndex.forEach(item => {
        if(!newFilter.items.has(item)){
          this.unfilteredIndex.add(item);
          this.filteredIndex.delete(item);
        }
      });
    }

    console.log(this.filteredIndex);
  }

  removeFilter(filterId: string): void {
    // if filter doesn't exist don't do anything
    if (!this.isFilterId(filterId))
      return;

    // remove the filter
    const oldFilter = this.filters[filterId];
    const oldFilterItems = oldFilter?.items ?? new Set();
    delete this.filters[filterId];

    // if no filters left call remove all and stop
    if (Object.keys(this.filters).length <= 0) {
      this.reset();
      return;
    }

    // add in the values that you are removing 
    oldFilterItems.forEach(item => this.unfilteredIndex.add(item));

    // remove filter initatives 
    // TODO: CAN YOU OPTIMISE THIS ? (currently running at o(n) )
    for(const filterId2 in this.filters) {
      const filter = this.filters[filterId2];
      if (!filter) continue;

      filter.items.forEach(item => {
        // add in unique ones
        this.filteredIndex.add(item);
        // remove the ones you added
        this.unfilteredIndex.delete(item);
      });
    }
  }
}


export class MapUI {
  public map?: Map;
  private mapPresenter?: MapPresenter;
  // for deferred load of sidebarView - breaking a recursive dep
  readonly getSidebarPresenter: (f: MapUI) => Promise<SidebarPresenter>;
  readonly markers: MarkerManager;
  readonly labels: PhraseBook;
  readonly filter: FilterService<Initiative>;
  
  constructor(readonly config: Config,
              readonly dataServices: DataServices) {
    this.markers = new MarkerManager(this);
    this.labels = this.dataServices.getFunctionalLabels();
    this.filter = new FilterService();
    
    // This is here to resolve a circular dependency loop - MapUI needs the SidebarView
    // when it runs, but SidebarView needs a link to the MapUI.
    // Maybe later the code can be untangled further so there is no loop.
    this.getSidebarPresenter = (mapUI: MapUI) => {
      return new Promise<SidebarPresenter>((resolve) => {
        const sidebarPresenter = new SidebarPresenter(mapUI);
        resolve(sidebarPresenter);
      });
    };
  }

  createMap() {
    if (this.mapPresenter) return;
    
    this.mapPresenter = this.createPresenter();
    this.map = this.mapPresenter.createMap(); // Link this back for views to access
  }
  
  
  onNewInitiatives() {
    const loadedInitiatives = this.dataServices.getAggregatedData().loadedInitiatives;
    this.filter.reset(loadedInitiatives);
  }
  
  createPresenter(): MapPresenter {
    return new MapPresenter(this);
  }  
}

