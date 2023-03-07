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
  filterName?: string;
  verboseName?: string;
  initiatives: I[];
}

/// Manages a set of filtered/unfiltered items of type I
export class FilterService<I> {
  // The set of all items. Should be unchanged.
  private allItems: Dictionary<I> = {};
  
  filteredIndex: Dictionary<I> = {}; // filteredInitiativesuidmap
  unfilteredIndex: Dictionary<I> = {}; // initiativesOutsideOfFilterUIDMap

  /// An index of filter names to a list of items matched by that filter
  filtered: Dictionary<string[]> = {}; // filtered
  verboseNamesMap: Dictionary = {};
  hidden: string[] = [];

  constructor() {
  }

  /// Resets the filter to the unfiltered state, including all the given items.
  ///
  /// Note: copies the index so that changes do not alter the original index.
  reset(items?: Dictionary<I>) {
    if (items)
      this.allItems = items;
    this.filtered = {};
    this.filteredIndex = {};
    this.verboseNamesMap = {};
    this.unfilteredIndex = Object.assign({}, this.allItems);
  }

  /// Gets an array of the current filtered items' ids
  getFilteredIds(): string[] {
    return Object.keys(this.filteredIndex);
  }

  /// Gets an array of the current unfiltered items' ids
  getUnfilteredIds(): string[] {
    return Object.keys(this.unfilteredIndex);
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
      const initiatives = filtered.map(id => this.allItems[id]);
      filterArray.push({
        filterName: filterId,
        verboseName: this.verboseNamesMap[filterId] ?? '',
        initiatives: compactArray(initiatives),
      })
    }
    
    return filterArray;
  }

  getFiltersVerbose(): string[] {
    return Object.values(this.verboseNamesMap)
      .filter((i): i is string => i !== undefined);
  }

  isFiltered(id: string): boolean {
    return !!this.filtered[id];
  }
  
  addFilter(name: string, itemIds: string[], verboseName?: string): void {
    // if filter already exists don't do anything
    if (this.isFiltered(name))
      return;

    this.filtered[name] = itemIds;
    this.verboseNamesMap[name] = verboseName;
    
    // if this is the first filter, add items to the filteredInitiativesUIDMap
    if (Object.keys(this.filtered).length <= 1) {
      this.unfilteredIndex = Object.assign({}, this.allItems);
      
      // add to array only new unique entries
      for(const id of itemIds) {
        const item = this.allItems[id];
        // rm entry from outside map
        delete this.unfilteredIndex[id];
        this.filteredIndex[id] = item;
      }
    }
    else {      
      // if this is the second or more filter, remove items from the 
      // filteredIndex if they don't appear in the new filter's set of initiatives
      for(const id in this.filteredIndex){
        const item = this.allItems[id];
        if(item && !itemIds.includes(id)){
          this.unfilteredIndex[id] = Object.assign({},this.filteredIndex[id]);
          delete this.filteredIndex[id];
        }
      }
    }

    console.log(this.filteredIndex);
  }

  removeFilter(filterId: string): void {
    // if filter doesn't exist don't do anything
    if (!this.isFiltered(filterId))
      return;

    // remove the filter
    const oldFilterIds = this.filtered[filterId] ?? [];
    delete this.filtered[filterId];

    // if no filters left call remove all and stop
    if (Object.keys(this.filtered).length <= 0) {
      this.reset();
      return;
    }

    // add in the values that you are removing 
    for(const id of oldFilterIds) {      
      this.unfilteredIndex[id] = this.allItems[id];
    }

    // remove filter initatives 
    // TODO: CAN YOU OPTIMISE THIS ? (currently running at o(n) )
    for(const filterId2 in this.filtered) {
      const ids = this.filtered[filterId2];
      if (!ids) continue;

      for(const id in ids) {
        // add in unique ones
        this.filteredIndex[id] = this.allItems[id];
        // remove the ones you added
        delete this.unfilteredIndex[id];
      }
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
    this.filter.reset(this.dataServices.getAggregatedData().initiativesByUid);
    this.loadedInitiatives = this.dataServices.getAggregatedData().loadedInitiatives;
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

