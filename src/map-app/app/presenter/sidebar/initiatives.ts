import { Dictionary } from '../../../common_types';
import * as eventbus from '../../eventbus';
import { DataServices, Filter, Initiative, MultiPropDef, VocabPropDef } from '../../model/dataservices';
import { InitiativesSidebarView } from '../../view/sidebar/initiatives';
import { MapPresenterFactory } from '../map';
import { BaseSidebarPresenter } from './base';
import { StackItem } from '../../../stack';
import { Config } from '../../model/config';
import { SearchResults } from './searchresults';

function arrayMax(array: number[]) {
  return array.reduce((a, b) => Math.max(a ?? Number.NEGATIVE_INFINITY, b ?? Number.NEGATIVE_INFINITY));
}

function arrayMin(array: number[]) {
  return array.reduce((a, b) => Math.min(a ?? Number.POSITIVE_INFINITY, b ?? Number.POSITIVE_INFINITY));
}


export class InitiativesSidebarPresenter extends BaseSidebarPresenter {
  readonly config: Config;
  readonly dataServices: DataServices;
  readonly labels: Partial<Record<string, string>>;
  readonly map: MapPresenterFactory;
  
  _eventbusRegister(): void {

    eventbus.subscribe({
      topic: "Search.initiativeResults",
      callback: (data: { text: string, results: Initiative[] }) => {
        this.onInitiativeResults(data);
      }
    });
    /*
       eventbus.subscribe({
       topic: "Datasets.filterDataset",
       callback: (data) => {
       //this.onInitiativeResults(data);
       }
       });
     */

    eventbus.subscribe({
      topic: "Marker.SelectionToggled",
      callback: (data) => {
        this.onMarkerSelectionToggled(data);
      }
    });
    eventbus.subscribe({
      topic: "Marker.SelectionSet",
      callback: (data: Initiative) => {
        this.onMarkerSelectionSet(data);
      }
    });
    eventbus.subscribe({
      topic: "Directory.initiativeClicked",
      callback: (data) => {
        this.onInitiativeClickedInSidebar(data);
      }
    });

    eventbus.subscribe({
      topic: "Initiatives.showSearchHistory",
      callback: (data) => {
        this.onSearchHistory()
      }
    });

    eventbus.subscribe({
      topic: "Initiatives.searchedInitiativeClicked",
      callback: (data: { initiative: Initiative }) => {
        this.searchedInitiativeClicked(data.initiative.uri)
      }
    });

    eventbus.subscribe({
      topic: "Search.changeSearchText",
      callback: (data) => {
        this.changeSearchText(data.txt)
      }
    });
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
      eventbus.publish({
        topic: "Markers.needToShowLatestSelection",
        data: {
          selected: newContent
        }
      });
  }

  notifyMapNeedsToNeedsToBeZoomedAndPanned(sidebarWidth: number = 0) {
    const initiatives = this.parent.contentStack.current()?.initiatives;
    if (!initiatives) return;

    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ],
          options: {
            paddingTopLeft: [sidebarWidth, window.innerHeight / 2],
            paddingBottomRight: [0, 0]
          }
        }
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
      let oldFilter: Filter = currentFilters.find(filter => {
        filter && filter.verboseName?.split(":")[0] === filterCategoryName
      })
      
      if (oldFilter) {
        eventbus.publish({
          topic: "Map.removeFilter",
          data: oldFilter
        });
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
    let filterData: Filter = {
      filterName: filterValue,
      initiatives: filteredInitiatives,
      verboseName: filterCategoryName + ": " + filterValueText
    }

    eventbus.publish({
      topic: "Map.addFilter",
      data: filterData
    });

    eventbus.publish({
      topic: "Map.addSearchFilter",
      data: filterData
    });
  }

  removeFilters() {
    eventbus.publish(
      {
        topic: "Directory.removeFilters",
        data: null
      });
  }

  notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative: Initiative, sidebarWidth: number = 0) {
    const initiatives = [initiative];
    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.selectAndZoomOnInitiative",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          // ,options: {
          //   paddingTopLeft: [sidebarWidth, window.innerHeight / 2],
          //   paddingBottomRight: [0, 0]
          //   //,maxZoom: 12
          // }
        }
      });
    }
  }

  notifyShowInitiativeTooltip(initiative: Initiative) {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  }

  notifyHideInitiativeTooltip(initiative: Initiative) {
    eventbus.publish({
      topic: "Map.needToHideInitiativeTooltip",
      data: initiative
    });
  }

  notifySidebarNeedsToShowInitiatives() {
    eventbus.publish({ topic: "Sidebar.showInitiatives" });
  }
  
  historyButtonsUsed(lastContent: StackItem) {
    //console.log("sidebar/initiatives historyButtonsUsed");
    //console.log(lastContent);
    //this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view?.refresh();
  }

  onInitiativeResults(data: { text: string, results: Initiative[] }) {
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
    const data2: Filter = {
      initiatives: data.results
    };
    eventbus.publish({
      topic: "Map.addSearchFilter",
      data: data2,
    });

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
    eventbus.publish({
      topic: "Directory.InitiativeClicked",
      data: initiative
    });
    if (window.outerWidth <= 800) {
      eventbus.publish({
        topic: "Directory.InitiativeClickedSidebar.hideSidebar",
        data: { initiative: initiative }
      });
    }
  }

  onInitiativeClickedInSidebar(data: { text: string, initiative: Initiative }) {
    console.log(data)

    const initiative = data.initiative;
    //this.parent.contentStack.append(new StackItem([initiative]));
    //console.log(this.parent.contentStack.current());

    this.notifyMapNeedsToNeedsToBeZoomedAndPannedOneInitiative(initiative);
    this.view?.refresh();
    eventbus.publish({
      topic: "Initiatives.searchedInitiativeClicked",
      data: { initiative: data.initiative }
    });
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
    eventbus.publish({
      topic: "Map.removeSearchFilter",
      data: {}
    });
  }

  searchedInitiativeClicked(uri: string) {
    this.view?.onInitiativeClicked(uri);
  }

  performSearch(text: string) {
    console.log("Search submitted: [" + text + "]");
    // We need to make sure that the search sidebar is loaded
    if (text.length > 0) {
      eventbus.publish({
        topic: "Sidebar.hideInitiativeList"
      });
      eventbus.publish({
        topic: "Markers.needToShowLatestSelection",
        data: {
          selected: []
        }
      });

      //should be async
      var results = this.dataServices.getAggregatedData().search(text);
      eventbus.publish({
        topic: "Search.initiativeResults",
        data: { text: text, results: results }
      });
    }

    else {
      this.performSearchNoText();
    }
  }

  performSearchNoText() {
    console.log("perform search no text")

    eventbus.publish({
      topic: "Sidebar.hideInitiativeList"
    });
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });

    //should be async
    var results = Object.values(this.dataServices.getAggregatedData().initiativesByUid);

    eventbus.publish({
      topic: "Search.initiativeResults",
      data: {
        text: "",
        results: results
      }
    });
  }

  changeSearchText(txt: string) {
    this.view?.changeSearchText(txt);
  }
}
