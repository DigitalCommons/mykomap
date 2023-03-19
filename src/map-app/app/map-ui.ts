import { Dictionary } from "../common-types";
import { Initiative } from "./model/initiative";
import { Map } from "./map";
import { MapPresenter } from "./presenter/map";
import { MarkerManager } from "./marker-manager";
import { Config } from "./model/config";
import { AnyVocabPropDef, DataServices } from "./model/data-services";
import { EventBus } from "../eventbus";
import "./map"; // Seems to be needed to prod the leaflet CSS into loading.
import { SidebarPresenter } from "./presenter/sidebar";
import { PhraseBook } from "../localisations";
import { compactArray, initiativeUris, toString as _toString } from '../utils';
import { SearchFilter, SearchResults, StateStack } from '../search-results';

/// Expresses a filtering operation on a FilterService<I>
export interface Filter<I> {
  result: I[];
  propName: string;
  propValue: unknown;
}

type MapFilter = Filter<Initiative>;

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
  readonly filter: FilterService<Initiative>;
  private readonly contentStack = new StateStack();
  
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

    EventBus.Directory.initiativeClicked.sub(initiative => this.onInitiativeClickedInSidebar(initiative));
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

  addFilter(data: MapFilter) {
    // add filter
    this.filter.addFilter(data);

    // apply filters
    this.applyFilter();
  }

  removeFilters(): void {
    const initiatives = this.dataServices.getAggregatedData().loadedInitiatives;
    this.filter.reset(initiatives);
    this.markers.updateVisibility(new Set(initiatives));
  }

  removeFilter(filterName: string) {
    this.filter.removeFilter(filterName);

    //apply filters
    this.applyFilter();
  }

  /// Returns a list of property values matching the given filter
  getAlternatePossibleFilterValues(filters: MapFilter[], propName: string): unknown[] {
    //construct an array of the filters that aren't the one matching the field
    let otherFilters: MapFilter[] = [];
    filters.forEach(filter => {
      if (filter.propName !== propName)
        otherFilters.push(filter);
    });

    //find the set of shared initiatives from the other filters
    let sharedInitiatives: Initiative[] = [];
    otherFilters.forEach((filter, i) => {
      if (i < 1)
        sharedInitiatives = filter.result;
      else
        //loop through sharedInitiatives and remove ones without a match in filter.initiatives
        sharedInitiatives = sharedInitiatives.filter(initiative =>
          filter.result.includes(initiative)
        );
    });

    //find the initiative variable associated with the field
    const alternatePossibleFilterValues: unknown[] = [];
    const vocabID = this.dataServices.getVocabTitlesAndVocabIDs()[propName];
    if (vocabID) {
      // Find the first propdef which uses this vocabID. This may not
      // be the only one!  However, this is how it was implemented
      // before, and we're only taking the first step to fixing that
      // here.
      const propEnt = Object.entries(this.dataServices.getVocabPropDefs())
        .find((ent): ent is [string, AnyVocabPropDef] => ent[1]?.uri === vocabID);
      if (propEnt) {
        //loop through the initiatives and get the possible values for the initiative variable
        sharedInitiatives.forEach(initiative => {
          const prop = initiative[propEnt[0]]
          if (prop !== undefined)
            alternatePossibleFilterValues.push(prop);
        })
      }
    }

    return alternatePossibleFilterValues;
  }
    
  private addSearchFilter(initiatives: Initiative[]) {
    
    //if no results remove the filter, currently commented out
    if (initiatives.length == 0) {
      // uncommenting this will reveal all initiatives on a failed search
      // this.removeSearchFilter();
      // return;
      console.log("no results, hide everything");
      // hide all 
      this.filter.hidden = this.dataServices.getAggregatedData().loadedInitiatives;
      this.markers.updateVisibility(new Set());
      return;
    }

    /*
       //this was causing a bug and doesn't seem to do anything useful

       //if the results match the previous results don't do anything
       if (initiatives == this.lastRequest)
       return;

       this.lastRequest = initiatives; //cache the last request
     */


    //get the ids from the passed data
    //hide the ones you need to  hide, i.e. difference between ALL and initiativesMap
    const allInitiatives = this.dataServices.getAggregatedData().loadedInitiatives;
    const notFiltered = initiatives.filter(it => !allInitiatives.includes(it));
    this.filter.hidden = notFiltered;

    //make sure the markers you need to highlight are shown
    this.markers.updateVisibility(new Set(initiatives));

    //zoom and pan

    if (initiatives.length > 0) {
      var options: EventBus.Map.ZoomOptions = {
        maxZoom: this.config.getMaxZoomOnSearch()
      } 
      if (options.maxZoom == 0)
        options = {};

      const latlng = this.dataServices.latLngBounds(initiatives)
      EventBus.Map.needsToBeZoomedAndPanned.pub({
          initiatives: initiatives,
          bounds: latlng,
          options: options
      });
    }
  }

  removeSearchFilter() {

    //if no search filter to remove just return
    if (this.filter.hidden.length === 0)
      return;

    this.applyFilter();

    // FIXME why do what seems to be more or less the same as applyFilter does here?

    //hide the initiatives that were outside of the filter
    this.markers.updateVisibility(new Set(this.filter.getFiltered()));
    // this can be sped up
    // you can speed up the above statement by replacing this.getUnfiltered() 
    // with the difference between getFiltered() and data.initiatives
    // i.e. getting the initiatives that are outside of the filter but still shown

    //reset the hidden array
    this.filter.hidden = [];

    EventBus.Markers.needToShowLatestSelection.pub([]);
  }

  /// - propName  is the title of the property being filtered
  /// - filterValue is the value of the selected drop-down value (typically an abbreviated vocab URI,
  ///   but could also be undefined to indicate all/any value
  /// - filterValueText is the display text for the selecte drop-down value
  /// - searchText the current value of the text search, or an empty string.
  changeFilters(propName: string, filterValue: string|undefined, filterValueText: string, searchText: string) {
    
    // Get the property definition for propName
    const vocabProps = this.dataServices.getVocabPropDefs();
    const propDef = vocabProps[propName];
    if (!propDef)
      throw new Error(`filterable field ${propName} is not a vocab field, which is not currently supported`);
    // FIXME implement support for this later

    // Get the vocab for this property
    const vocabs = this.dataServices.getLocalisedVocabs();
    const vocab = vocabs[propDef.uri];
    if (!vocab)
      throw new Error(`filterable field ${propName} does not use a known vocab: ${propDef.uri}`);

    //remove old filter 
    const currentFilters = this.filter.getFiltersFull();

    if (currentFilters && currentFilters.length > 0) {
      const oldFilter = currentFilters.find(filter => {
        filter && filter.propName === propName
      })
      
      if (oldFilter) {
        this.removeFilter(oldFilter.propName);
      }
    }

    //if filterValueText is undefined, don't add a new filter
    if (filterValue !== undefined) {

    // Get initiatives for new filter
    const allInitiatives = compactArray(Object.values(this.dataServices.getAggregatedData().initiativesByUid));
    let filteredInitiatives = Initiative.filter(allInitiatives, propName, filterValue);

    // Apply the text search on top
    filteredInitiatives = Initiative.textSearch(searchText, filteredInitiatives);

    // create new filter
    let filterData: MapFilter = {
      result: filteredInitiatives,
      propName: propName,
      propValue: filterValue,
    }
    this.addFilter(filterData);
      this.addSearchFilter(filteredInitiatives);
    }
    
    // After changing the filter, we need to repeat the last text
		// search on top of that, if there is one.
    const lastSearchResults = this.contentStack.current();
		if (lastSearchResults instanceof SearchResults) {
			this.performSearch(lastSearchResults.searchedFor);
    }
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
    const lastContent = this.contentStack.current();
    // Make a clone of the current initiatives:
    const initiatives =
      lastContent !== undefined ? lastContent.initiatives.slice(0) : [];
    const index = initiatives.indexOf(initiative);
    if (index == -1) {
      initiatives.push(initiative);
    } else {
      // remove elment form array (sigh - is this really the best array method for this?)
      initiatives.splice(index, 1);
    }
    //this.contentStack.append(new SearchResults(initiatives));
    if (lastContent) {
      EventBus.Markers.needToShowLatestSelection.pub(lastContent.initiatives);
    }      
  }


  performSearch(text: string) {
    console.log("Search submitted: [" + text + "]");
    // We need to make sure that the search sidebar is loaded
    EventBus.Sidebar.hideInitiativeList.pub();
    EventBus.Markers.needToShowLatestSelection.pub([]);
    let results = this.dataServices.getAggregatedData().loadedInitiatives;
    if (text.length > 0) {
      //should be async
      results = Initiative.textSearch(text, results);
    }
    else {
      results = Initiative.textSort(results); // Make a sorted copy
    }
    
    // Get the uniquids of the applied filters
    const filterKeys = initiativeUris(this.filter.getFiltered());

    // Go in if there are any filters
    if (filterKeys.length != 0) {
      //get the intersection of the filtered content and the search data
      //search results should be a subset of filtered

      results = results.filter(initiative =>
        filterKeys.includes(_toString(initiative.uri))
                              );
    }

    // (SearchFilter is a subset of MapFilter)
    const searchFilters: SearchFilter[] = this.filter.getFiltersFull()
    const searchResults = new SearchResults(results, text,
                                            searchFilters,
                                            this.labels);
    this.contentStack.push(searchResults);


    //highlight markers on search results 
    //reveal all potentially hidden markers before zooming in on them
    this.addSearchFilter(results);

    if (results.length == 1) {
      this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(results[0]);
    }
    else if (results.length == 0) {
      //do nothing on failed search
      console.log("no results");
    }
    else {
      //this.notifyMarkersNeedToShowNewSelection(lastContent);
      //deselect all
      // notifyMapNeedsToNeedsToBeZoomedAndPanned
      const initiatives = this.contentStack.current()?.initiatives;
      if (!initiatives || initiatives.length <= 0)
        return;
      const data = EventBus.Map.mkSelectAndZoomData(initiatives);
      EventBus.Map.needsToBeZoomedAndPanned.pub(data);
    }

    EventBus.Sidebar.showInitiatives.pub();
  }

  // Text to show in the search box
  //
  // Basically, the text of the last search, or the empty string if none.
  getSearchText(): string {
    const lastSearchResults = this.contentStack.current();
    if (lastSearchResults instanceof SearchResults)
      return lastSearchResults.searchedFor;
    return "";
  }

  // A localised, human readable description of the current search state
  //
  // Includes text and filtering.
  getSearchDescription(): string {
    const lastSearchResults = this.contentStack.current();
    if (lastSearchResults instanceof SearchResults)
    	return `${this.labels.search}: ${lastSearchResults.searchString}`;
    return "";
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

  private applyFilter() {
    this.markers.updateVisibility(new Set(this.filter.getFiltered()));
  }

  private notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative: Initiative) {
    const data = EventBus.Map.mkSelectAndZoomData([initiative]);
    EventBus.Map.needsToBeZoomedAndPanned.pub(data);
  }
  
  private onInitiativeClickedInSidebar(initiative?: Initiative) {
    if (!initiative)
      return;
    
    //this.parent.mapui.contentStack.append(new SearchResults([initiative]));
    //console.log(this.parent.mapui.contentStack.current());

    this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative);
    this.refreshSidebar();
    EventBus.Initiative.searchedInitiativeClicked.pub(initiative);
  }

  currentItem() {
    return this.contentStack.current();
  }

  isAtStart() {
    return this.contentStack.isAtStart();
  }

  isAtEnd() {
    return this.contentStack.isAtEnd();
  }

  back(): void {
    //console.log("backButtonClicked");
    //console.log(this);
    const lastContent = this.contentStack.current();
    const newContent = this.contentStack.previous();
    if (!newContent || newContent == lastContent)
      return;
    
    // TODO: Think: maybe better to call a method on this that indicates thay
    //       the contentStack has been changed.
    //       Then it is up to the this to perform other actions related to this
    //       (e.g. where it affects which initiatives are selected)
    //this.view.refresh();

    this.removeFilters();

    if (newContent instanceof SearchResults && newContent.filters[0]) {
      newContent.filters.forEach(filter=>{
        let filterData: MapFilter = {
          result: newContent.initiatives,
          propName: filter.propName,
          propValue: filter.propValue,
        };
        this.addFilter(filterData);
      });
    }

    this.addSearchFilter(newContent.initiatives);
  }
  
  forward(): void {
    //console.log("forwardButtonClicked");
    //console.log(this);
    const lastContent = this.contentStack.current();
    const newContent = this.contentStack.next();
    if (newContent == lastContent)
      return;
    //this.view.refresh();
    if (newContent && newContent instanceof SearchResults) {
      this.removeFilters();

      if (newContent.filters[0]) {
        newContent.filters.forEach(filter=>{
          let filterData: MapFilter = {
            result: newContent.initiatives,
            propName: filter.propName,
            propValue: filter.propValue,
          };
          this.addFilter(filterData);
        });
      }

      this.addSearchFilter(newContent.initiatives);
    }
    else {
      this.removeSearchFilter();
    }
  }
}

