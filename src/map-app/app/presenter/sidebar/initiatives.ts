import { EventBus } from '../../../eventbus';
import { InitiativesSidebarView } from '../../view/sidebar/initiatives';
import { BaseSidebarPresenter } from './base';
import { SearchResults } from '../../../search-results';
import { Initiative } from '../../model/initiative';
import { compactArray, toString as _toString } from '../../../utils';
import { SidebarPresenter } from '../sidebar';
import { MapFilter } from '../../map-ui';

export class InitiativesSidebarPresenter extends BaseSidebarPresenter {
  readonly view: InitiativesSidebarView;
  
  _eventbusRegister(): void {
    EventBus.Marker.selectionToggled.sub(initiative => this.onMarkerSelectionToggled(initiative));
    EventBus.Marker.selectionSet.sub(initiative => this.onMarkerSelectionSet(initiative));
    EventBus.Initiatives.showSearchHistory.sub(() => this.onSearchHistory())
    EventBus.Initiative.searchedInitiativeClicked.sub(initiative => this.searchedInitiativeClicked(_toString(initiative.uri, undefined)));
    EventBus.Search.changeSearchText.sub(text => this.changeSearchText(text));
  }

  constructor(readonly parent: SidebarPresenter) {
    super(parent);
    this.view = new InitiativesSidebarView(this);
    this._eventbusRegister();
  }

  currentItem (): SearchResults | undefined {
    return this.parent.mapui.contentStack.current();
  }

  notifyMarkersNeedToShowNewSelection(lastContent: SearchResults, newContent?: Initiative[]) {
    if (!newContent)
      newContent = this.parent.mapui.contentStack.current()?.initiatives
    if (newContent)
      EventBus.Markers.needToShowLatestSelection.pub(newContent);
  }

  /// - propName  is the title of the property being filtered
  /// - filterValue is the value of the selected drop-down value (typically an abbreviated vocab URI,
  ///   but could also be "any"
  /// - filterValueText is the display text for the selecte drop-down value
  /// - searchText the current value of the text search, or an empty string.
  changeFilters(propName: string, filterValue: string, filterValueText: string, searchText: string) {
    const mapui = this.parent.mapui;
    
    // Get the property definition for propName
    const vocabProps = mapui.dataServices.getVocabPropDefs();
    const propDef = vocabProps[propName];
    if (!propDef)
      throw new Error(`filterable field ${propName} is not a vocab field, which is not currently supported`);
    // FIXME implement support for this later

    // Get the vocab for this property
    const vocabs = mapui.dataServices.getLocalisedVocabs();
    const vocab = vocabs[propDef.uri];
    if (!vocab)
      throw new Error(`filterable field ${propName} does not use a known vocab: ${propDef.uri}`);

    //remove old filter 
    const currentFilters = mapui.filter.getFiltersFull();

    if (currentFilters && currentFilters.length > 0) {
      const oldFilter = currentFilters.find(filter => {
        filter && filter.localisedVocabTitle === vocab.title // FIXME ideally use propDef.uri
      })
      
      if (oldFilter) {
        this.parent.mapui.removeFilter(oldFilter.filterName);
      }
    }

    //if filter is any, don't add a new filter
    if (filterValue === "any")
      return;

    // Get initiatives for new filter
    const allInitiatives = compactArray(Object.values(mapui.dataServices.getAggregatedData().initiativesByUid));
    let filteredInitiatives = Initiative.filter(allInitiatives, propName, filterValue);

    // Apply the text search on top
    filteredInitiatives = Initiative.textSearch(searchText, filteredInitiatives);

    // create new filter
    let filterData: MapFilter = {
      filterName: filterValue,
      result: filteredInitiatives,
      localisedVocabTitle: vocab.title,
      localisedTerm: filterValueText,
      verboseName: vocab.title + ": " + filterValueText,
      propName: propName,
      propValue: filterValue,
    }
    this.parent.mapui.addFilter(filterData);
    this.parent.mapui.addSearchFilter(filteredInitiatives);
  }

  removeFilters() {
    EventBus.Directory.removeFilters.pub(undefined);
  }


  notifyShowInitiativeTooltip(initiative: Initiative) {
    EventBus.Map.needToShowInitiativeTooltip.pub(initiative);
  }

  notifyHideInitiativeTooltip(initiative: Initiative) {
    EventBus.Map.needToHideInitiativeTooltip.pub(initiative);
  }

  historyButtonsUsed() {
    //console.log("sidebar/initiatives historyButtonsUsed");
    //console.log(lastContent);
    //this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view.refresh();
  }

  initClicked(initiative: Initiative) {
    EventBus.Directory.initiativeClicked.pub(initiative);
    if (window.outerWidth <= 800) {
      EventBus.Directory.initiativeClickedHideSidebar.pub(initiative);
    }
  }
  
  onInitiativeMouseoverInSidebar(initiative: Initiative) {
    this.notifyShowInitiativeTooltip(initiative);
  }

  onInitiativeMouseoutInSidebar(initiative: Initiative) {
    this.notifyHideInitiativeTooltip(initiative);
  }
  
  onMarkerSelectionSet(initiative: Initiative) {
    //console.log(initiative);
    const lastContent = this.parent.mapui.contentStack.current();
    //this.parent.mapui.contentStack.append(new SearchResults([initiative]));
    if (lastContent)
      this.notifyMarkersNeedToShowNewSelection(lastContent);
    // this.notifySidebarNeedsToShowInitiatives();
    this.view.refresh();
  }

  onMarkerSelectionToggled(initiative: Initiative) {
    const lastContent = this.parent.mapui.contentStack.current();
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
    if (lastContent)
      this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view.refresh();
  }

  onSearchHistory() {
    this.parent.mapui.contentStack.gotoEnd();
    this.parent.mapui.removeSearchFilter();
  }

  searchedInitiativeClicked(uri?: string) {
    if (uri) this.view.onInitiativeClicked(uri);
  }

  performSearch(text: string) {
    console.log("Search submitted: [" + text + "]");
    // We need to make sure that the search sidebar is loaded
    if (text.length > 0) {
      EventBus.Sidebar.hideInitiativeList.pub();
      EventBus.Markers.needToShowLatestSelection.pub([]);

      //should be async
      const results = Initiative.textSearch(text, this.parent.mapui.dataServices.getAggregatedData().loadedInitiatives);      
      this.parent.mapui.onInitiativeResults({ text: text, results: Initiative.textSort(results) });
    }

    else {
      this.performSearchNoText();
    }
  }

  performSearchNoText() {
    console.log("perform search no text")
    EventBus.Sidebar.hideInitiativeList.pub();
    EventBus.Markers.needToShowLatestSelection.pub([]);

    //should be async
    var results = Object.values(this.parent.mapui.dataServices.getAggregatedData().initiativesByUid)
      .filter((i): i is Initiative => !!i);
    this.parent.mapui.onInitiativeResults({ text: "", results: results });
  }

  changeSearchText(txt: string) {
    this.view.changeSearchText(txt);
  }
}

