import { Marker } from "leaflet";
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

export class MapUI {
  initiativesOutsideOfFilterUIDMap: Dictionary<Initiative> = {};
  public loadedInitiatives: Initiative[] = [];
  filtered: Dictionary<Initiative[]> = {};
  filteredInitiativesUIDMap: Dictionary<Initiative> = {};
  verboseNamesMap: Dictionary = {};
  hidden: Initiative[] = [];
  public map?: Map;
  private mapPresenter?: MapPresenter;
  // for deferred load of sidebarView - breaking a recursive dep
  readonly getSidebarPresenter: (f: MapUI) => Promise<SidebarPresenter>;
  readonly markers: MarkerManager;
  readonly labels: PhraseBook;
  
  constructor(readonly config: Config,
              readonly dataServices: DataServices) {
    this.markers = new MarkerManager(this);
    this.labels = this.dataServices.getFunctionalLabels();
    
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
    this.initiativesOutsideOfFilterUIDMap = Object.assign(
      {}, this.dataServices.getAggregatedData().initiativesByUid
    );
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
  
  //should return an array of unique initiatives in filters
  getFiltered(): Initiative[] {
    return Object.values(this.filteredInitiativesUIDMap)
      .filter((i): i is Initiative => i !== undefined);
  }

  getFilteredMap() {
    return this.filteredInitiativesUIDMap;
  }

  getFilters(){
    return Object.keys(this.filtered);
  }

  getFiltersFull(): EventBus.Map.Filter[] {
    const filterArray: EventBus.Map.Filter[] = []
    
    for(let filterName in this.verboseNamesMap){
      filterArray.push({
        filterName: filterName,
        verboseName: this.verboseNamesMap[filterName] ?? '',
        initiatives: this.filtered[filterName] ?? []
      })
    }

    return filterArray;
  }

  getFiltersVerbose(): string[] {
    return Object.values(this.verboseNamesMap)
      .filter((i): i is string => i !== undefined);
  }
}

