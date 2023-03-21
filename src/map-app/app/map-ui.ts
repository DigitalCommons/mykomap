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
import { Action, AppState, PropEquality, StateManager, TextSearch } from "./state-manager";
import { StateChange } from "../undo-stack";

/// Expresses a filtering operation on a FilterService<I>
export interface Filter<I> {
  result: I[];
  propName: string;
  propValue: unknown;
}

interface FilterDef<I> {
  items: Set<I>;
  propName: string;
  propValue: unknown;
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
        propName: filter.propName,
        propValue: filter.propValue,
        result: Array.from(filter.items),
      })
    }
    
    return filterArray;
  }

  getFiltersVerbose(): string[] {
    const filters = compactArray(Object.values(this.filters));
    return filters.map(f => `${f.propName}: ${f.propValue}`); // FIXME temporarily not localised!
  }

  isFilterId(id: string): boolean {
    return !!this.filters[id];
  }

  addFilter(filter: Filter<I>): void {
    // if filter already exists don't do anything
    if (filter.propName && this.filters[filter.propName])
      return;

    const newFilter: FilterDef<I> = {
      items: new Set(filter.result),
      propName: filter.propName,
      propValue: filter.propValue,
    };
    this.filters[filter.propName] = newFilter;
    
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
  private readonly getSidebarPresenter: (f: MapUI) => Promise<SidebarPresenter>;
  readonly markers: MarkerManager;
  readonly labels: PhraseBook;
  private readonly stateManager: StateManager;
  private sidebarPresenter: SidebarPresenter|undefined;
  
  constructor(readonly config: Config,
              readonly dataServices: DataServices) {
    this.markers = new MarkerManager(this);
    this.labels = this.dataServices.getFunctionalLabels();

    const allInitiatives = new Set(dataServices.getAggregatedData().loadedInitiatives);
    const initialState = new AppState(allInitiatives, allInitiatives);
    this.stateManager = new StateManager(initialState, change => this.onStateChange(change));
    
    // This is here to resolve a circular dependency loop - MapUI needs the SidebarView
    // when it runs, but SidebarView needs a link to the MapUI.
    // Maybe later the code can be untangled further so there is no loop.
    this.getSidebarPresenter = (mapUI: MapUI) => {
      return new Promise<SidebarPresenter>((resolve) => {
        if (!this.sidebarPresenter)
          this.sidebarPresenter = new SidebarPresenter(mapUI);
        resolve(this.sidebarPresenter);
      });
    };

    EventBus.Directory.initiativeClicked.sub(initiative => this.onInitiativeClickedInSidebar(initiative));
  }

  createMap() {
    if (this.mapPresenter) return;
    
    this.mapPresenter = this.createPresenter();
    this.map = this.mapPresenter.createMap(); // Link this back for views to access
  }
  
  private onStateChange(change: StateChange<AppState, Action|undefined>) {
    const visibleInitiatives = change.result.visibleInitiatives;
    this.markers.updateVisibility(visibleInitiatives);
    
    const data = EventBus.Map.mkSelectAndZoomData(Array.from(visibleInitiatives));
    EventBus.Map.needsToBeZoomedAndPanned.pub(data);
  }
  
  onNewInitiatives() {
    const loadedInitiatives = this.dataServices.getAggregatedData().loadedInitiatives;
    this.stateManager.reset(loadedInitiatives);
  }
  
  createPresenter(): MapPresenter {
    return new MapPresenter(this);
  }

  removeFilters(): void {
    this.stateManager.clearPropFilters();
  }

  removeFilter(filterName: string) {
    this.stateManager.clearPropFilter(filterName);
  }

  resetSearch(): void {
    this.stateManager.reset();
  }

  /// Returns a list of property values matching the given filter
  getAlternatePossibleFilterValues(propName: string) {
    return this.stateManager.altValues(propName);
  }
    
  /// - propName  is the title of the property being filtered
  /// - value is the value of the selected drop-down value (typically an abbreviated vocab URI,
  ///   but could also be undefined to indicate all/any value
  changeFilters(propName: string, value?: string) {
    const propDef = this.config.fields()[propName];
    if (!propDef)
      throw new Error(`an attempt to add a filter on an unknown propery name '${propName}'`);

    const isMulti = propDef.type === 'multi';
    if (value === undefined)
      this.stateManager.clearPropFilter(propName);
    else
      this.stateManager.propFilter(new PropEquality(propName, value, isMulti));
  }

  isSelected(initiative: Initiative): boolean {
    // Currently unimplemented - I can see an sea-initiative-active class
    // being applied if a test was true, but it makes no sense in the current
    // context AFAICT. The test was:
    // initiative === this.contextStack.current()?.initiatives[0]

    // The main thing is seemed to do is highlight an initiative (or
    // initiatives) in the directory pop-out list of initiatives in a
    // category.
    
    // For now, just return false always. We may re-implement this later.
    return false; 
  }

  toggleSelectInitiative(initiative: Initiative) {
    // Currently unimplemented.
    
    // EventBus.Markers.needToShowLatestSelection.pub(lastContent.initiatives);
  }


  performSearch(text: string) {
    console.log("Search submitted: [" + text + "]");
    this.stateManager.textSearch(new TextSearch(text));
  }

  // Text to show in the search box
  //
  // Basically, the text of the last search, or the empty string if none.
  getSearchText(): string {
    return this.stateManager.currentState.textSearch.searchText;
  }

  // A localised, human readable description of the current search state
  //
  // Includes text and filtering.
  getSearchDescription(): string {
    //throw new Error();
    /*
    FIXME
    const lastSearchResults = this.stateManager.currentState;
    if (lastSearchResults instanceof SearchResults)
    	return `${this.labels.search}: ${lastSearchResults.searchString}`;*/
    return "FIXME";
  }

  
  onLoad() {
    console.log("Map loaded");
    
    // Trigger loading of the sidebar, the deps should all be in place now.
    this.getSidebarPresenter(this).then(sidebar => {
      const defaultOpenSidebar = this.config.getDefaultOpenSidebar();
      if (defaultOpenSidebar)
        sidebar.showSidebar()
    });
  }

  private refreshSidebar() {
    this.getSidebarPresenter(this).then((presenter) => presenter.changeSidebar());
  }



  private notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative: Initiative) {
    const data = EventBus.Map.mkSelectAndZoomData([initiative]);
    EventBus.Map.needsToBeZoomedAndPanned.pub(data);
  }
  
  private onInitiativeClickedInSidebar(initiative?: Initiative) {
    if (!initiative)
      return;
    
    //this.parent.mapui.stateManager.append(new SearchResults([initiative]));
    //console.log(this.parent.mapui.stateManager.current());

    this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative);
    this.refreshSidebar();
    EventBus.Initiative.searchedInitiativeClicked.pub(initiative);
  }

  currentItem() {
    return this.stateManager.currentState;
  }

  isAtStart() {
    return this.stateManager.isAtStart;
  }

  isAtEnd() {
    return this.stateManager.isAtEnd;
  }

  back(): void {
    this.stateManager.back();
  }
  
  forward(): void {
    this.stateManager.forward();
  }
}

