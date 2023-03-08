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
import { toString as _toString } from '../utils';

/// Expresses a filtering operation on a FilterService<I>
export interface Filter<I> {
  filterName?: string;
  verboseName?: string;
  result: I[];
}

/// Manages a set of filtered/unfiltered items of type I
export class FilterService<I> {
  // The set of all items. Should be unchanged.
  private allItems: I[] = [];
  
  private filteredIndex: Set<I> = new Set();
  private unfilteredIndex: Set<I> = new Set();

  /// An index of filter names to a list of items matched by that filter
  private filtered: Dictionary<Set<I>> = {};
  private verboseNamesMap: Dictionary = {};
  hidden: I[] = [];

  constructor() {
  }

  /// Resets the filter to the unfiltered state, including all the given items.
  ///
  /// Note: copies the index so that changes do not alter the original index.
  reset(items?: I[]) {
    if (items)
      this.allItems = items;
    this.filtered = {};
    this.filteredIndex = new Set();
    this.verboseNamesMap = {};
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
    return Object.keys(this.filtered);
  }

  getFiltersFull(): Filter<I>[] {
    const filterArray: Filter<I>[] = []
    
    for(let filterId in this.verboseNamesMap){
      const filtered = this.filtered[filterId];
      if (!filtered)
        continue;
      filterArray.push({
        filterName: filterId,
        verboseName: this.verboseNamesMap[filterId] ?? '',
        result: Array.from(filtered),
      })
    }
    
    return filterArray;
  }

  getFiltersVerbose(): string[] {
    return Object.values(this.verboseNamesMap)
      .filter((i): i is string => i !== undefined);
  }

  isFilterId(id: string): boolean {
    return !!this.filtered[id];
  }
  
  addFilter(name: string, items: I[], verboseName?: string): void {
    // if filter already exists don't do anything
    if (this.isFilterId(name))
      return;

    const itemSet = this.filtered[name] = new Set(items);
    this.verboseNamesMap[name] = verboseName;
    
    // if this is the first filter, add items to the filteredInitiativesUIDMap
    if (Object.keys(this.filtered).length <= 1) {
      this.unfilteredIndex = new Set(this.allItems);
      
      // add to array only new unique entries
      for(const item of items) {
        // rm entry from outside map
        this.unfilteredIndex.delete(item);
        this.filteredIndex.add(item);
      }
    }
    else {      
      // if this is the second or more filter, remove items from the 
      // filteredIndex if they don't appear in the new filter's set of initiatives
      this.filteredIndex.forEach(item => {
        if(!itemSet.has(item)){
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
    const oldFilterItems = this.filtered[filterId] ?? new Set();
    delete this.filtered[filterId];

    // if no filters left call remove all and stop
    if (Object.keys(this.filtered).length <= 0) {
      this.reset();
      return;
    }

    // add in the values that you are removing 
    oldFilterItems.forEach(item => this.unfilteredIndex.add(item));

    // remove filter initatives 
    // TODO: CAN YOU OPTIMISE THIS ? (currently running at o(n) )
    for(const filterId2 in this.filtered) {
      const items = this.filtered[filterId2];
      if (!items) continue;

      items.forEach(item => {
        // add in unique ones
        this.filteredIndex.add(item);
        // remove the ones you added
        this.unfilteredIndex.delete(item);
      });
    }

    // remove filter from verbose name
    delete this.verboseNamesMap[filterId];
  }
}


export class MapUI {
  public loadedInitiatives: Initiative[] = [];
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
    this.mapPresenter.view.createMap();
    this.map = this.mapPresenter.view.map; // Link this back for views to access
  }
  
  
  onNewInitiatives() {
    this.loadedInitiatives = this.dataServices.getAggregatedData().loadedInitiatives;
    this.filter.reset(this.loadedInitiatives);
  }
  
  createPresenter(): MapPresenter {
    const p = new MapPresenter(this);
    EventBus.Initiatives.datasetLoaded.sub(() => {
      this.onNewInitiatives();
      p.onInitiativeDatasetLoaded();
    });
    EventBus.Initiative.created.sub(initiative => p.onInitiativeNew(initiative));
    EventBus.Initiative.refreshed.sub(initiative => {
      this.onNewInitiatives();
      p.refreshInitiative(initiative);
    });
    EventBus.Initiatives.reset.sub(() => {
        this.onNewInitiatives();
        p.onInitiativeReset();
    });
    EventBus.Initiatives.loadComplete.sub(() => {
      this.onNewInitiatives();
      p.onInitiativeLoadComplete();
      p.onInitiativeComplete();
    });
    EventBus.Initiatives.loadStarted.sub(() => p.onInitiativeLoadMessage());
    EventBus.Initiatives.loadFailed.sub(error => p.onInitiativeLoadMessage(error));
    
    EventBus.Markers.needToShowLatestSelection.sub(initiative => p.onMarkersNeedToShowLatestSelection(initiative));
    EventBus.Map.needsToBeZoomedAndPanned.sub(data => p.onMapNeedsToBeZoomedAndPanned(data));
    EventBus.Map.needToShowInitiativeTooltip.sub(initiative => p.onNeedToShowInitiativeTooltip(initiative));
    EventBus.Map.needToHideInitiativeTooltip.sub(initiative => p.onNeedToHideInitiativeTooltip(initiative));
    EventBus.Map.setZoom.sub(zoom => p.setZoom(zoom));
    EventBus.Map.setActiveArea.sub(area => p.setActiveArea(area.offset));
    EventBus.Map.fitBounds.sub(bounds => p.onBoundsRequested(bounds));
    EventBus.Map.selectAndZoomOnInitiative.sub(zoom => p.selectAndZoomOnInitiative(zoom));
    EventBus.Map.addFilter.sub(filter => p.addFilter(filter));
    EventBus.Map.removeFilter.sub(filter => p.removeFilter(filter));
    EventBus.Map.removeFilters.sub(() => p.removeFilters());
    EventBus.Map.addSearchFilter.sub(filter => p.addSearchFilter(filter));
    EventBus.Map.removeSearchFilter.sub(() => p.removeSearchFilter());

    return p;
  }  
}

