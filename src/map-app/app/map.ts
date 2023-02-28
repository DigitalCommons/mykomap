import * as leaflet from 'leaflet';
import 'leaflet-active-area';
//import * as contextmenu from 'leaflet-contextmenu';
import 'leaflet.markercluster';
import 'leaflet.awesome-markers';

/* This code is needed to properly load the stylesheet, and images in the Leaflet CSS */
import 'leaflet/dist/leaflet.css';

// This is a hack added to allow leaflet icons be the right size
// @ts-ignore 
delete leaflet.Icon.Default.prototype._getIconUrl;
leaflet.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


// Methods for leaflet-contextmenu
export interface ContextMap {
}

// Methods for leaflet-active-area
// This plug-in doesn't have any typescript annotations published.
export interface ActiveMap {
  setActiveArea(
    css: { position: string; top: string; left: string; right: string; bottom: string;},
    refocusMap: boolean, animateRefocus: boolean
  ): void;
}

export type Map = leaflet.Map & ActiveMap & ContextMap;


// Cater for the earlier JS hack in which a boolean is stored in
// marker objects...
//interface ExtendedMarkerOptions extends leaflet.MarkerOptions {
//  initiative: Initiative;
//}
export interface ExtendedMarker extends leaflet.Marker {
  hasPhysicalLocation?: boolean;
//  options: ExtendedMarkerOptions;
}

