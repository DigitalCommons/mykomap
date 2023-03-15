import { BasePresenter } from './base';
import { EventBus } from '../../eventbus';
import { MapView } from '../view/map';
import { Initiative } from '../model/initiative';
import { initiativeUris, toString as _toString } from '../../utils';
import { MapFilter, MapSearch, MapUI } from '../map-ui';
import { Map } from '../map';

export class MapPresenter extends BasePresenter {
  readonly view: MapView;
  private previouslySelected: Initiative[] = [];
  
  constructor(readonly mapUI: MapUI) {
    super();
    this.view = new MapView(this);

    EventBus.Initiatives.datasetLoaded.sub(() => {
      this.mapUI.onNewInitiatives();
      this.onInitiativeDatasetLoaded();
    });
    EventBus.Initiative.created.sub(initiative => this.mapUI.markers.createMarker(initiative));
    EventBus.Initiative.refreshed.sub(initiative => {
      this.mapUI.onNewInitiatives();
      this.mapUI.markers.refreshMarker(initiative);
    });
    EventBus.Initiatives.reset.sub(() => {
        this.mapUI.onNewInitiatives();
        this.onInitiativeReset();
    });
    EventBus.Initiatives.loadComplete.sub(() => {
      this.mapUI.onNewInitiatives();
      this.onInitiativeLoadComplete();
      this.onInitiativeComplete();
    });
    EventBus.Initiatives.loadStarted.sub(() => this.onInitiativeLoadMessage());
    EventBus.Initiatives.loadFailed.sub(error => this.onInitiativeLoadMessage(error));
    
    EventBus.Markers.needToShowLatestSelection.sub(initiative => this.onMarkersNeedToShowLatestSelection(initiative));
    EventBus.Map.needsToBeZoomedAndPanned.sub(data => this.onMapNeedsToBeZoomedAndPanned(data));
    EventBus.Map.needToShowInitiativeTooltip.sub(initiative => this.onNeedToShowInitiativeTooltip(initiative));
    EventBus.Map.needToHideInitiativeTooltip.sub(initiative => this.onNeedToHideInitiativeTooltip(initiative));
    EventBus.Map.setZoom.sub(zoom => this.setZoom(zoom));
    EventBus.Map.setActiveArea.sub(area => this.setActiveArea(area.offset));
    EventBus.Map.fitBounds.sub(bounds => this.onBoundsRequested(bounds));
    EventBus.Map.selectAndZoomOnInitiative.sub(zoom => this.selectAndZoomOnInitiative(zoom));
    EventBus.Map.addFilter.sub(filter => this.addFilter(filter));
    EventBus.Map.removeFilter.sub(filter => this.removeFilter(filter));
    EventBus.Map.removeFilters.sub(() => this.removeFilters());
    EventBus.Map.addSearchFilter.sub(filter => this.addSearchFilter(filter));
    EventBus.Map.removeSearchFilter.sub(() => this.removeSearchFilter());
  }
    
  createMap(): Map {
    const map = this.view.createMap(
      this.mapUI.config.getMapAttribution(),
      this.mapUI.config.getDisableClusteringAtZoom(),
      this.mapUI.config.getTileUrl()
    );

    // Now the view's (un)selectedClusterGroup should have been updated
    if (this.view.selectedClusterGroup)
      this.mapUI.markers.setSelectedClusterGroup(this.view.selectedClusterGroup);
    if (this.view.unselectedClusterGroup)
      this.mapUI.markers.setUnselectedClusterGroup(this.view.unselectedClusterGroup);

    return map;
  }

  onInitiativeClicked() {
    EventBus.Directory.initiativeClicked.pub(undefined);
  }

  onLoad() {
    console.log("Map loaded");
    
    let defaultOpenSidebar = this.mapUI.config.getDefaultOpenSidebar();
    
    // Trigger loading of the sidebar, the deps should all be in place now.
    this.mapUI.getSidebarPresenter(this.mapUI).then(sidebar => {
      if (defaultOpenSidebar)
        sidebar.showSidebar()
    });
  }
  
  private onInitiativeReset() {
    this.mapUI.markers.destroyAll();
    console.log("removing all");
    //rm markers 
  }

  private onInitiativeComplete() {
    // Load the markers into the clustergroup
    const bounds = this.getInitialBounds();
    if (bounds)
      this.view.fitBounds({bounds: bounds});
    this.view.unselectedClusterGroup?.addLayers(this.mapUI.markers.withPhysicalLocation());
    console.log("onInitiativeComplete");
  }


  private onInitiativeDatasetLoaded() {
    console.log("onInitiativeDatasetLoaded");
    //console.log(data);
    //console.log(data.latLngBounds());
    // this.view.fitBounds([[-45.87859, -162.60022], [76.47861, 176.84446]]);
  }

  private onInitiativeLoadComplete() {
    /* The protecting veil is now obsolete. */
    //view.clearProtectingVeil();
    // TODO - hook this up to a log?
    this.view.stopLoading();

  }
  
  private onInitiativeLoadMessage(error?: EventBus.Initiatives.DatasetError) {
    this.view.startLoading(error);
  }

  onMarkersNeedToShowLatestSelection(selected: Initiative[]) {
    this.previouslySelected.forEach((initiative) => {
      this.mapUI.markers.setUnselected(initiative);
    });

    this.previouslySelected = selected;
    
    //zoom in and then select 
    selected.forEach((initiative) => {
      this.mapUI.markers.setSelected(initiative);
    });
  }

  private onNeedToShowInitiativeTooltip(initiative: Initiative) {
    this.mapUI.markers.showTooltip(initiative);
  }
  
  private onNeedToHideInitiativeTooltip(initiative: Initiative) {
    this.mapUI.markers.hideTooltip(initiative);
  }
  
  private onMapNeedsToBeZoomedAndPanned(latLngBounds: EventBus.Map.SelectAndZoomData) {
    console.log("onMapNeedsToBeZoomedAndPanned ", latLngBounds);
    this.view.flyToBounds(latLngBounds);
    // this.view.flyTo(data);
    // this.view.setView(data);
  }

  private onBoundsRequested(data: EventBus.Map.BoundsData) {
    this.view.fitBounds(data);
  }

  private setZoom(zoom: number) {
    console.log("Zooming to ", zoom);
    this.view.setZoom(zoom);
  }

  private getInitialBounds() {
    return this.mapUI.config.getInitialBounds() == undefined ?
           this.mapUI.dataServices.latLngBounds() : this.mapUI.config.getInitialBounds();
  }

  private setActiveArea(offset: number) {
    this.view.setActiveArea(offset);
  }



  //FILTERS
  private applyFilter() {
    this.mapUI.markers.updateVisibility(new Set(this.mapUI.filter.getFiltered()));
  }

  private addFilter(data: MapFilter) {
    // add filter
    this.mapUI.filter.addFilter(data);

    // apply filters
    this.applyFilter();
  }

  private removeFilters(): void {
    const initiatives = this.mapUI.dataServices.getAggregatedData().loadedInitiatives;
    this.mapUI.filter.reset(initiatives);
    this.mapUI.markers.updateVisibility(new Set(initiatives));
  }

  private removeFilter(filterName: string) {
    this.mapUI.filter.removeFilter(filterName);

    //apply filters
    this.applyFilter();
  }

  //FILTERS END


  //SEARCH HIGHLIGHT


  //highlights markers, hides markers not in the current selection
  private addSearchFilter(data: MapSearch) {
    
    //if no results remove the filter, currently commented out
    if (data.result.length == 0) {
      // uncommenting this will reveal all initiatives on a failed search
      // this.removeSearchFilter();
      // return;
      console.log("no results, hide everything");
      // hide all 
      this.mapUI.filter.hidden = this.mapUI.dataServices.getAggregatedData().loadedInitiatives;
      this.mapUI.markers.updateVisibility(new Set());
      return;
    }

    /*
       //this was causing a bug and doesn't seem to do anything useful

       //if the results match the previous results don't do anything
       if (data.initiatives == this.mapUI.lastRequest)
       return;

       this.mapUI.lastRequest = data.initiatives; //cache the last request
     */


    //get the ids from the passed data
    //hide the ones you need to  hide, i.e. difference between ALL and initiativesMap
    const initiatives = this.mapUI.dataServices.getAggregatedData().loadedInitiatives;
    const notFiltered = data.result.filter(it => !initiatives.includes(it));
    this.mapUI.filter.hidden = notFiltered;

    //make sure the markers you need to highlight are shown
    this.mapUI.markers.updateVisibility(new Set(data.result));

    //zoom and pan

    if (data.result.length > 0) {
      var options: EventBus.Map.ZoomOptions = {
        maxZoom: this.mapUI.config.getMaxZoomOnSearch()
      } 
      if (options.maxZoom == 0)
        options = {};

      const latlng = this.mapUI.dataServices.latLngBounds(data.result)
      EventBus.Map.needsToBeZoomedAndPanned.pub({
          initiatives: data.result,
          bounds: latlng,
          options: options
      });
    }
  }

  getLogo() {
    return this.mapUI.config.logo();
  }

  private selectAndZoomOnInitiative(data: EventBus.Map.SelectAndZoomData) {
    this.view.selectAndZoomOnInitiative(data);
  }

  //this can get called multiple times make sure it doesn't crash
  private removeSearchFilter() {

    //if no search filter to remove just return
    if (this.mapUI.filter.hidden.length === 0)
      return;

    this.applyFilter();

    // FIXME why do what seems to be more or less the same as applyFilter does here?

    //hide the initiatives that were outside of the filter
    this.mapUI.markers.updateVisibility(new Set(this.mapUI.filter.getFiltered()));
    // this can be sped up
    // you can speed up the above statement by replacing this.getUnfiltered() 
    // with the difference between getFiltered() and data.initiatives
    // i.e. getting the initiatives that are outside of the filter but still shown

    //reset the hidden array
    this.mapUI.filter.hidden = [];

    EventBus.Markers.needToShowLatestSelection.pub([]);
  }
  //END SEARCH HIGHLIGHT
}
