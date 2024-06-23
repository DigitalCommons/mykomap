import * as leaflet from 'leaflet';
import * as Supercluster from 'supercluster';
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
  private readonly markerForInitiative = new Map<Initiative, MapMarkerPresenter>();
  
  // CAUTION: this may be either a ClusterGroup, or the map itself
  nonGeoClusterGroup = new Supercluster(); // FIXME options
  geoClusterGroup = new Supercluster(); // FIXME options


  constructor(readonly mapUI: MapUI) {
    this.popup = mapUI.config.getCustomPopup() || getPopup;
  }

  setSelected(initiative: Initiative) {
    this.markerForInitiative.get(initiative)?.view.setSelected(initiative);
  }
  setUnselected(initiative: Initiative) {
    this.markerForInitiative.get(initiative)?.view.setUnselected(initiative);
  }

  destroyAll() {
    this.markerForInitiative.forEach((_, initiative) => {
      this.markerForInitiative.get(initiative)?.view.destroy();
    });
    this.markerForInitiative.clear();
  }

  updateVisibility(visibleInitiatives: Set<Initiative>) {
    this.markerForInitiative.forEach((marker, initiative) => {
      if (visibleInitiatives.has(initiative)) {
        if (!marker.view.isVisible())
          marker.view.show();
      }
      else {
        if (marker.view.isVisible())
          marker.view.destroy();
      }
    })
  }

  createMarker(initiative: Initiative) {
    const uri = _toString(initiative.uri, null);
    if (uri === null)
      throw new Error(`initiative is missing the mandatory uri property: ${initiative}`);
    const presenter = new MapMarkerPresenter(this.mapUI, initiative, this.popup);
    this.markerForInitiative.set(initiative, presenter);
    return presenter;
  }

  refreshMarker(initiative: Initiative) {
    const marker = this.markerForInitiative.get(initiative);
    if (marker)
      marker.view.marker.setPopupContent(marker.getInitiativeContent(initiative));
  }

  setNonGeoClusterGroup(clusterGroup: Supercluster) {
    this.nonGeoClusterGroup = clusterGroup;
  }

  setGeoClusterGroup(clusterGroup: Supercluster) {
    this.geoClusterGroup = clusterGroup;
  }

  showTooltip(initiative: Initiative) {
    this.markerForInitiative.get(initiative)?.view.showTooltip(initiative);
  }
  
  hideTooltip(initiative: Initiative) {
    this.markerForInitiative.get(initiative)?.view.hideTooltip(initiative);
  }

  getInitiativeContent(initiative: Initiative) {
    // console.log(this.getInitiativeContent(initiative));
    const marker = this.markerForInitiative.get(initiative);
    if (marker)
      return marker.getInitiativeContent(initiative);
    else
      return undefined;
  }

  getClusterGroup() {
    return this.geoClusterGroup;
  }
  
  withPhysicalLocation(): Supercluster.PointFeature<Supercluster.AnyProps>[] {
    return Array.from(this.markerForInitiative.values())
      .map((mp) => mp?.hasPhysicalLocation?
        mp.view.marker.toGeoJSON() : undefined)
      .filter((marker): marker is Supercluster.PointFeature<leaflet.Marker> =>
        marker !== undefined)
  }
}
