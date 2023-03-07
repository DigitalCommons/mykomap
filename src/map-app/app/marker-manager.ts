import { Dictionary } from '../common-types';
import * as leaflet from 'leaflet';
import { InitiativeRenderFunction } from './model/config-schema';
import { Initiative } from './model/initiative';
import { toString as _toString } from '../utils';
import { MapMarkerPresenter } from './presenter/map/marker';
import { MapUI } from './map-ui';
import { getPopup } from './default-popup';

export class MarkerManager {
  private readonly popup: InitiativeRenderFunction;
  
  // Keep a mapping between initiatives and their Markers:
  // Note: contents currently contain only the active dataset
  markerForInitiative: Dictionary<MapMarkerPresenter> = {};
  
  // CAUTION: this may be either a ClusterGroup, or the map itself
  hiddenClusterGroup: leaflet.MarkerClusterGroup = new leaflet.MarkerClusterGroup();
  unselectedClusterGroup: leaflet.MarkerClusterGroup = new leaflet.MarkerClusterGroup();


  constructor(readonly mapUI: MapUI) {
    this.popup = mapUI.config.getCustomPopup() || getPopup;
  }

  setSelected(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.view.setSelected(initiative);
  }
  setUnselected(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.view.setUnselected(initiative);
  }

  destroyAll() {
    let initiatives = Object.keys(this.markerForInitiative);
    initiatives.forEach(initiative => {
      this.markerForInitiative[initiative]?.view.destroy();
    });
    this.markerForInitiative = {};
  }

  showMarkers(initiativeUris: string[]) {
    //show markers only if it is not currently vissible
    initiativeUris.forEach(uri => {
      const marker = this.markerForInitiative[uri];
      if (marker && !marker.view.isVisible())
        marker.view.show();
    });

  }

  hideMarkers(initiativeUris: string[]) {
    initiativeUris.forEach(uri => {
      if (this.markerForInitiative[uri])
        this.markerForInitiative[uri]?.view.destroy();
    });
  }

  createMarker(initiative: Initiative) {
    const uri = _toString(initiative.uri, null);
    if (uri === null)
      throw new Error(`initiative is missing the mandatory uri property: ${initiative}`);
    const presenter = new MapMarkerPresenter(this.mapUI, initiative, this.popup);
    this.markerForInitiative[uri] = presenter;
    return presenter;
  }

  refreshMarker(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    if (!this.markerForInitiative[uri])
      return;

    const marker = this.markerForInitiative[uri];
    if (!marker) {
      console.error("no marker for initiative", initiative);
      return;
    }
    
    marker.view.marker.setPopupContent(marker.getInitiativeContent(initiative));
  }

  setSelectedClusterGroup(clusterGroup: leaflet.MarkerClusterGroup) {
    // CAUTION: this may be either a ClusterGroup, or the map itself
    this.hiddenClusterGroup = clusterGroup;
  }

  setUnselectedClusterGroup(clusterGroup: leaflet.MarkerClusterGroup) {
    this.unselectedClusterGroup = clusterGroup;
  }

  showTooltip(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.view.showTooltip(initiative);
  }
  
  hideTooltip(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.view.hideTooltip(initiative);
  }

  getInitiativeContent(initiative: Initiative) {
    // console.log(this.getInitiativeContent(initiative));
    const uri = _toString(initiative.uri);
    if (this.markerForInitiative[uri])
      return this.markerForInitiative[uri]?.getInitiativeContent(
        initiative
      );
    else return undefined;
  }

  getClusterGroup() {
    return this.unselectedClusterGroup;
  }
  
  withPhysicalLocation(): leaflet.Marker[] {
    return Object.values(this.markerForInitiative)
      .map((mp) => mp?.hasPhysicalLocation? mp.view.marker : undefined)
      .filter((marker): marker is leaflet.Marker => marker !== undefined)
  }
}
