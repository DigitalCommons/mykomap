import { Dictionary, Point2d } from '../../../common_types';
import { MapMarkerView } from './marker';
import * as leaflet from 'leaflet';
import { InitiativeRenderFunction } from '../../model/config_schema';
import { DataServices } from '../../model/dataservices';
import { Initiative } from '../../model/initiative';
import { toString as _toString } from '../../../utils';
import { Map } from '../../map';

export class MarkerViewFactory {

  // Keep a mapping between initiatives and their Markers:
  // Note: contents currently contain only the active dataset
  markerForInitiative: Dictionary<MapMarkerView> = {};
  
  // CAUTION: this may be either a ClusterGroup, or the map itself
  hiddenClusterGroup: leaflet.MarkerClusterGroup = new leaflet.MarkerClusterGroup();
  unselectedClusterGroup: leaflet.MarkerClusterGroup = new leaflet.MarkerClusterGroup();


  constructor(readonly defaultLatLng: Point2d,
              readonly popup: InitiativeRenderFunction,
              readonly dataServices: DataServices) {
  }

  setSelected(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.setSelected(initiative);
  }
  setUnselected(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.setUnselected(initiative);
  }

  destroyAll() {
    let initiatives = Object.keys(this.markerForInitiative);
    initiatives.forEach(initiative => {
      this.markerForInitiative[initiative]?.destroy();
    });
    this.markerForInitiative = {};
  }

  showMarkers(initiatives: Initiative[]) {
    //show markers only if it is not currently vissible
    initiatives.forEach(initiative => {
      const uri = _toString(initiative.uri);      
      const marker = this.markerForInitiative[uri];
      if (marker && !marker.isVisible())
        marker.show();
    });

  }

  hideMarkers(initiatives: Initiative[]) {
    initiatives.forEach(initiative => {
      const uri = _toString(initiative.uri);      
      if (this.markerForInitiative[uri])
        this.markerForInitiative[uri]?.destroy();
    });
  }

  createMarker(map: Map, initiative: Initiative) {
    const uri = _toString(initiative.uri, null);
    if (uri === null)
      throw new Error(`initiative is missing the mandatory uri property: ${initiative}`);
    const view = new MapMarkerView(this.dataServices, this.popup, map, initiative, this.defaultLatLng, this);
    this.markerForInitiative[uri] = view;
    return view;
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
    
    marker.marker.setPopupContent(marker.presenter.getInitiativeContent(initiative));
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
    this.markerForInitiative[uri]?.showTooltip(initiative);
  }
  
  hideTooltip(initiative: Initiative) {
    const uri = _toString(initiative.uri);
    this.markerForInitiative[uri]?.hideTooltip(initiative);
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
  
}
