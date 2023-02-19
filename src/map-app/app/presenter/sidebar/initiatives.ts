import { Dictionary } from '../../../common_types';
import { EventBus } from '../../../eventbus';
import { DataServices, MultiPropDef, VocabPropDef } from '../../model/dataservices';
import { InitiativesSidebarView } from '../../view/sidebar/initiatives';
import { MapPresenterFactory } from '../map';
import { BaseSidebarPresenter } from './base';
import { StackItem } from '../../../stack';
import { Config } from '../../model/config';
import { SearchResults } from './searchresults';
import { Initiative } from '../../model/initiative';

export class InitiativesSidebarPresenter extends BaseSidebarPresenter {
  readonly config: Config;
  readonly dataServices: DataServices;
  readonly labels: Partial<Record<string, string>>;
  readonly map: MapPresenterFactory;
  
  _eventbusRegister(): void {
    EventBus.Search.initiativeResults.sub(results => this.onInitiativeResults(results));
    EventBus.Marker.selectionToggled.sub(initiative => this.onMarkerSelectionToggled(initiative));
    EventBus.Marker.selectionSet.sub(initiative => this.onMarkerSelectionSet(initiative));
    EventBus.Directory.initiativeClicked.sub(initiative => this.onInitiativeClickedInSidebar(initiative));
    EventBus.Initiatives.showSearchHistory.sub(() => this.onSearchHistory())
    EventBus.Initiative.searchedInitiativeClicked.sub(initiative => this.searchedInitiativeClicked(initiative.uri));
    EventBus.Search.changeSearchText.sub(text => this.changeSearchText(text));
  }

  constructor(public view: InitiativesSidebarView, labels: Dictionary, config: Config, dataServices: DataServices, map: MapPresenterFactory) {
    if (!view.parent.presenter)
      throw new Error(`Can't construct an instance with a parent view which has no presenter`);
    super(view.parent.presenter);
    this.config = config;
    this.dataServices = dataServices;
    // a lookup for labels of buttons and titles
    this.labels = labels;
    // a MapPresenterFactory
    this.map = map;
    this._eventbusRegister();
  }

  currentItem (): StackItem | undefined {
    return this.parent.contentStack.current();
  }

  notifyMarkersNeedToShowNewSelection(lastContent: StackItem, newContent?: Initiative[]) {
    if (!newContent)
      newContent = this.parent.contentStack.current()?.initiatives
    if (newContent)
      EventBus.Markers.needToShowLatestSelection.pub(newContent);
  }

  notifyMapNeedsToNeedsToBeZoomedAndPanned(sidebarWidth: number = 0) {
    const initiatives = this.parent.contentStack.current()?.initiatives;
    if (!initiatives) return;

    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);

    if (initiatives.length > 0) {
      EventBus.Map.needsToBeZoomedAndPanned.pub({
        initiatives: initiatives,
        bounds: [
          [arrayMin(lats), arrayMin(lngs)],
          [arrayMax(lats), arrayMax(lngs)]
        ],
        options: {}
      });
    }
  }

  /// - filterCategoryName is the title of the filter option's vocab FIXME should be ID
  /// - filterValue is the value of the selected drop-down value (typically an abbreviated vocab URI,
  ///   but could also be "any"
  /// - filterValueText is the display text for the selecte drop-down value
  changeFilters(filterCategoryName: string, filterValue: string, filterValueText: string) {
    // Get the vocab URI from a map of vocab titles to abbreviated vocab URIs
    // FIXME if titles of vocabs match, this map will be incomplete!
    const vocabTitlesAndVocabIDs =  this.dataServices.getVocabTitlesAndVocabIDs(); 
    const vocabID = vocabTitlesAndVocabIDs[filterCategoryName];
    if (vocabID === undefined || vocabID === null)
      throw new Error(`Unknown title used to identify this vocab: '${filterCategoryName}'`);

    // Find the first matching property definition which uses this
    // vocab.  This obviously doesn't find cases when there are two
    // properties and we need a later definition, but the previous
    // implementation did not allow for that anyway, suing a simple
    // single-value look up map. We drop that map, and use the
    // propDefs, which is more typesafe, and FIXME can later be
    // modified to allow for this latter case, when suitable
    // information is provided. Currently the title field of the vocab
    // is used, which isn't sufficient to identify the property
    // uniquely.
    const propDefs = this.config.fields();
    let propName: string;
    let propDef: VocabPropDef | MultiPropDef | undefined;
    for(propName in propDefs) {
      const def = propDefs[propName];
      if (!def) continue;
      if (def.type === 'vocab' && def.uri === vocabID) {
        propDef = def;
        break;
      }
      if (def.type === 'multi' && def.of.type === 'vocab' && def.of.uri === vocabID) {
        propDef = def;
        break;
      }
    }
    
    if (!propDef)
      throw new Error(`Vocab titled '${vocabID}' is not used as any initiative properties`);

    //remove old filter 
    const currentFilters = this.map.getFiltersFull();

    if (currentFilters.length > 0) {
      const oldFilter = currentFilters.find(filter => {
        filter && filter.verboseName?.split(":")[0] === filterCategoryName
      })
      
      if (oldFilter?.filterName) {
        EventBus.Map.removeFilter.pub(oldFilter.filterName);
      }
    }

    //if filter is any, don't add a new filter
    if (filterValue === "any")
      return;

    // Get initiatives for new filter
    const allInitiatives = Object.values(this.dataServices.getAggregatedData().initiativesByUid);
    const filteredInitiatives = allInitiatives.filter((i): i is Initiative =>
      !!i && i[propName] == filterValue
    )

    //create new filter
    let filterData: EventBus.Map.Filter = {
      filterName: filterValue,
      initiatives: filteredInitiatives,
      verboseName: filterCategoryName + ": " + filterValueText
    }
    EventBus.Map.addFilter.pub(filterData);
    EventBus.Map.addSearchFilter.pub(filterData);
  }

  removeFilters() {
    EventBus.Directory.removeFilters.pub(undefined);
  }

  notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative: Initiative, sidebarWidth: number = 0) {
    const initiatives = [initiative];
    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);

    if (initiatives.length > 0) {
      EventBus.Map.selectAndZoomOnInitiative.pub({
        initiatives: initiatives,
        bounds: [
          [arrayMin(lats), arrayMin(lngs)],
          [arrayMax(lats), arrayMax(lngs)]
        ],
        options: {},
      });
    }
  }

  notifyShowInitiativeTooltip(initiative: Initiative) {
    EventBus.Map.needToShowInitiativeTooltip.pub(initiative);
  }

  notifyHideInitiativeTooltip(initiative: Initiative) {
    EventBus.Map.needToHideInitiativeTooltip.pub(initiative);
  }

  notifySidebarNeedsToShowInitiatives() {
    EventBus.Sidebar.showInitiatives.pub();
  }
  
  historyButtonsUsed(lastContent: StackItem) {
    //console.log("sidebar/initiatives historyButtonsUsed");
    //console.log(lastContent);
    //this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view?.refresh();
  }

  onInitiativeResults(data: EventBus.Search.Results) {
    // TODO - handle better when data.results is empty
    //        Prob don't want to put them on the stack?
    //        But still need to show the fact that there are no results.
    //get the uniquids of the applied filters
    const filterKeys = Object.keys(this.map.getFilteredMap());

    //go in if there are any filters
    if (filterKeys.length != 0) {
      //get the intersection of the filtered content and the search data
      //search results should be a subset of filtered

      data.results = data.results.filter(initiative =>
        filterKeys.includes(initiative.uri)
      );
    }

    //filter
    this.parent.contentStack.append(
      new SearchResults(data.results, data.text,
                        this.map.getFiltersVerbose(), this.map.getFilters(), this.labels)
    );

    //highlight markers on search results 
    //reveal all potentially hidden markers before zooming in on them
    EventBus.Map.addSearchFilter.pub({ initiatives: data.results });

    if (data.results.length == 1) {
      this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(data.results[0]);
    }
    else if (data.results.length == 0) {
      //do nothing on failed search
      console.log("no results");
    }
    else {
      //this.notifyMarkersNeedToShowNewSelection(lastContent);
      //deselect all
      this.notifyMapNeedsToNeedsToBeZoomedAndPanned(); //does not do anything?
    }

    this.notifySidebarNeedsToShowInitiatives();
    this.view?.refresh();
  }

  getFilterNames() {
    return this.map.getFiltersVerbose();
  }

  initClicked(initiative: Initiative) {
    EventBus.Directory.initiativeClicked.pub(initiative);
    if (window.outerWidth <= 800) {
      EventBus.Directory.initiativeClickedHideSidebar.pub(initiative);
    }
  }

  onInitiativeClickedInSidebar(initiative?: Initiative) {
    if (!initiative)
      return;
    
    //this.parent.contentStack.append(new StackItem([initiative]));
    //console.log(this.parent.contentStack.current());

    this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative);
    this.view?.refresh();
    EventBus.Initiative.searchedInitiativeClicked.pub(initiative);
  }
  
  onInitiativeMouseoverInSidebar(initiative: Initiative) {
    this.notifyShowInitiativeTooltip(initiative);
  }

  onInitiativeMouseoutInSidebar(initiative: Initiative) {
    this.notifyHideInitiativeTooltip(initiative);
  }
  
  onMarkerSelectionSet(initiative: Initiative) {
    //console.log(initiative);
    const lastContent = this.parent.contentStack.current();
    //this.parent.contentStack.append(new StackItem([initiative]));
    if (lastContent)
      this.notifyMarkersNeedToShowNewSelection(lastContent);
    // this.notifySidebarNeedsToShowInitiatives();
    this.view?.refresh();
  }

  onMarkerSelectionToggled(initiative: Initiative) {
    const lastContent = this.parent.contentStack.current();
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
    //this.contentStack.append(new StackItem(initiatives));
    if (lastContent)
      this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view?.refresh();
  }

  onSearchHistory() {
    this.parent.contentStack.gotoEnd();
    EventBus.Map.removeSearchFilter.pub();
  }

  searchedInitiativeClicked(uri: string) {
    this.view?.onInitiativeClicked(uri);
  }

  performSearch(text: string) {
    console.log("Search submitted: [" + text + "]");
    // We need to make sure that the search sidebar is loaded
    if (text.length > 0) {
      EventBus.Sidebar.hideInitiativeList.pub();
      EventBus.Markers.needToShowLatestSelection.pub([]);

      //should be async
      var results = this.dataServices.getAggregatedData().search(text);
      EventBus.Search.initiativeResults.pub({ text: text, results: results });
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
    var results = Object.values(this.dataServices.getAggregatedData().initiativesByUid)
      .filter((i): i is Initiative => !!i);
    EventBus.Search.initiativeResults.pub({ text: "", results: results });
  }

  changeSearchText(txt: string) {
    this.view?.changeSearchText(txt);
  }
}

function arrayMin(lats: any[]): number {
    throw new Error('Function not implemented.');
}

function arrayMax(lats: any[]): number {
    throw new Error('Function not implemented.');
}
