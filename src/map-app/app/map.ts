import mapboxgl from 'mapbox-gl';
// import 'leaflet-active-area';
// //import * as contextmenu from 'leaflet-contextmenu';
// import 'leaflet.markercluster';
// import 'leaflet.awesome-markers';

// /* This code is needed to properly load the stylesheet, and images in the Leaflet CSS */
// import 'leaflet/dist/leaflet.css';
import '../../../node_modules/mapbox-gl/dist/mapbox-gl.css';

// This is a hack added to allow leaflet icons be the right size
// @ts-ignore 
// delete leaflet.Icon.Default.prototype._getIconUrl;
// leaflet.Icon.Default.mergeOptions({
//   iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
//   iconUrl: require('leaflet/dist/images/marker-icon.png'),
//   shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
// });


// // Methods for leaflet-contextmenu
// export interface ContextMap {
// }

// Methods for leaflet-active-area
// This plug-in doesn't have any typescript annotations published.
// export interface ActiveMap {
//   setActiveArea(
//     css: { position: string; top: string; left: string; right: string; bottom: string;},
//     refocusMap: boolean, animateRefocus: boolean
//   ): void;
// }

export type Map = mapboxgl.Map;

