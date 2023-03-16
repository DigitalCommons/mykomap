import { BasePresenter } from './base';
import { EventBus } from '../../eventbus';
import { MapView } from '../view/map';
import { Initiative } from '../model/initiative';
import { toString as _toString } from '../../utils';
import { Map } from '../map';
import { MapUI } from '../map-ui';

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
    this.mapUI.onLoad();
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

  getLogo() {
    return this.mapUI.config.logo();
  }

  private selectAndZoomOnInitiative(data: EventBus.Map.SelectAndZoomData) {
    this.view.selectAndZoomOnInitiative(data);
  }

}
