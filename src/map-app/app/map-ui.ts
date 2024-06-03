import { Initiative } from "./model/initiative";
import { Map } from "./map";
import { MapPresenter } from "./presenter/map";
import { MarkerManager } from "./marker-manager";
import { Config } from "./model/config";
import { DataServices, isVocabPropDef } from "./model/data-services";
import { EventBus } from "../eventbus";
import "./map"; // Seems to be needed to prod the leaflet CSS into loading.
import { SidebarPresenter } from "./presenter/sidebar";
import { PhraseBook } from "../localisations";
import { toString as _toString, canDisplayExpandedSidebar } from '../utils';
import { Action, AppState, PropEquality, StateManager, TextSearch } from "./state-manager";
import { StateChange } from "../undo-stack";
import { Dictionary } from "../common-types";

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
    const initialFilters = this.mkInitialFilters();
    
    const initialState = AppState.startState(allInitiatives, undefined, initialFilters);

    // Set the intial state when constructing the StateManager. This will be the state
    // to which a reset returns to.
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

    EventBus.Map.initiativeClicked.sub(initiative => this.onInitiativeClicked(initiative));
    EventBus.Map.clearFiltersAndSearch.sub(() => this.clearFiltersAndSearch());
  }

  // This inspects the config and constructs an appropriate set of
  // filters to construct the initial AppState with.
  static mkInitialFilters(config: Config): Dictionary<PropEquality> {
    const filters: Dictionary<PropEquality> = {};
    const filteredFields = config.getFilteredPropDefs();
    for(const name in filteredFields) {
      const propDef = filteredFields[name];
      const filter = propDef.filter;
      if (filter != undefined) {
        // If we get here, this property should have a default filter
        // value set.

        // We can only filter Vocab properties (single or multi), so check that.
        if (isVocabPropDef(propDef)) {
          filters[name] = new PropEquality(
            name, filter, propDef.type === 'multi'
          );
        }
      }
    }
    return filters;
  }

  // This inspects the MapUI's config and constructs an appropriate
  // set of filters to construct the initial AppState with.
  private mkInitialFilters() {
    return MapUI.mkInitialFilters(this.config);
  }

  createMap() {
    if (this.mapPresenter) return;
    
    this.mapPresenter = this.createPresenter();
  }
  
  private onStateChange(change: StateChange<AppState, Action|undefined>) {
    const visibleInitiatives = change.result.visibleInitiatives;
    this.markers.updateVisibility(visibleInitiatives);

    this.refreshSidebar();
    
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

  clearFiltersAndSearch(): void {
    this.stateManager.clearFiltersAndSearch();
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
    if (value === undefined) {
      this.stateManager.clearPropFilter(propName);
    } else {
      this.stateManager.propFilter(new PropEquality(propName, value, isMulti));
    }

    if (canDisplayExpandedSidebar()) // on smaller screens, wait until user clicks Show Results
      EventBus.Sidebar.showInitiativeList.pub();
  }

  isSelected(initiative: Initiative): boolean {
    const selectedInitiatives = this.mapPresenter?.getSelectedInitiatives() ?? [];
    return  selectedInitiatives.includes(initiative);
  }

  toggleSelectInitiative(initiative: Initiative) {
    const selectedInitiatives = this.mapPresenter?.getSelectedInitiatives() ?? [];
    
    if (selectedInitiatives.includes(initiative)) {
      EventBus.Markers.needToShowLatestSelection.pub(selectedInitiatives.filter(i => i !== initiative));
    } else {
      EventBus.Markers.needToShowLatestSelection.pub([...selectedInitiatives, initiative]);
    }
  }

  performSearch(text: string) {
    console.log("Search submitted: [" + text + "]");
    this.stateManager.textSearch(new TextSearch(text));

    if (canDisplayExpandedSidebar()) {// on smaller screens, wait until user clicks Show Results
      EventBus.Sidebar.showInitiativeList.pub();
    }
  }

  // Text to show in the search box
  //
  // Basically, the text of the last search, or the empty string if none.
  getSearchText(): string {
    return this.stateManager.currentState.textSearch.searchText;
  }

  onLoad() {
    console.log("Map loaded");
    
    // Trigger loading of the sidebar, the deps should all be in place now.
    this.getSidebarPresenter(this).then(sidebar => {
      const defaultOpenSidebar = this.config.getDefaultOpenSidebar();
      if (defaultOpenSidebar)
        sidebar.showSidebar()
    }, (error) => console.error("Sidebar presenter load failed:", error));
  }

  private refreshSidebar() {
    this.getSidebarPresenter(this).then((presenter) => {
      presenter.changeSidebar();
    });
  }

  private notifyMapNeedsToNeedsToSelectAndZoomOnInitiative(initiative: Initiative) {
    const maxZoom = this.config.getMaxZoomOnOne();
    const defaultPos = this.config.getDefaultLatLng();
    
    const data = EventBus.Map.mkSelectAndZoomData([initiative], { maxZoom, defaultPos });
    EventBus.Map.selectAndZoomOnInitiative.pub(data);
  }
  
  private onInitiativeClicked(initiative?: Initiative) {
    console.log('Clicked', initiative);
    
    if (initiative) {
      // Move the window to the right position first
      this.notifyMapNeedsToNeedsToSelectAndZoomOnInitiative(initiative);
      this.refreshSidebar();
      // Populate the sidebar and highlight the intiative in the directory
      this.getSidebarPresenter(this).then((presenter) => {
        presenter.populateInitiativeSidebar(
          initiative,
          this.markers.getInitiativeContent(initiative) ?? ''
        );
      });
    }
    else {
      // User has deselected
      EventBus.Markers.needToShowLatestSelection.pub([]);
      this.getSidebarPresenter(this).then((presenter) => {
        presenter.hideInitiativeSidebar();
      });
    }

    this.refreshSidebar();
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

