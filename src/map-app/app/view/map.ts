import { Box2d, Dictionary } from "../../common_types";
import { MapPresenter, MapPresenterFactory } from "../presenter/map";
import { MarkerViewFactory } from "./map/marker";
import {  BaseView  } from './base';

import * as d3 from 'd3';
import * as leaflet from 'leaflet';
import 'leaflet-active-area';
//import * as contextmenu from 'leaflet-contextmenu';

/* This code is needed to properly load the stylesheet, and images in the Leaflet CSS */
import 'leaflet/dist/leaflet.css';
import { Initiative } from "../model/initiative";
import { EventBus } from "../../eventbus";

// This is a hack added to allow leaflet icons be the right size
// @ts-ignore 
delete leaflet.Icon.Default.prototype._getIconUrl;
leaflet.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Methods for leaflet-contextmenu
interface ContextMap {
  
}
// Methods for leaflet-active-area
// This plug-in doesn't have any typescript annotations published.
interface ActiveMap {
  setActiveArea(
    css: { position: string; top: string; left: string; right: string; bottom: string;},
    refocusMap: boolean, animateRefocus: boolean
  ): void;
}

export type Map = leaflet.Map & ActiveMap & ContextMap;

export class MapView extends BaseView {
  map?: Map;
  private flag: boolean = false;
  private _settingActiveArea: boolean = false;
  private readonly descriptionPercentage: number;
  private readonly dialogueSizeStyles: HTMLStyleElement;
  private selectedClusterGroup?: leaflet.MarkerClusterGroup;
  unselectedClusterGroup?: leaflet.MarkerClusterGroup;

  // Used to initialise the map for the "loading" spinner
  private static readonly spinMapInitHook: (this: leaflet.Map) => void = function() {
    this.on('layeradd', (e) => {
      // If added layer is currently loading, spin !
      if (typeof e.layer.on !== 'function') return;
      e.layer.on('data:loading', () => {}, this);
      e.layer.on('data:loaded', () => {}, this);
    }, this);
    this.on('layerremove', (e) => {
      // Clean-up
      if (typeof e.layer.on !== 'function') return;
      e.layer.off('data:loaded');
      e.layer.off('data:loading');
    }, this);
  }
  
  /// Initialises the view, but does not create the map yet.
  ///
  /// To do that, call #createMap
  constructor(readonly presenter: MapPresenter,
              readonly labels: Dictionary,
              readonly dialogueHeight: string = '225px', // MUST BE IN PX
              readonly dialogueWidth: string = '35vw',
              readonly descriptionRatio: number = 2.5,
              readonly markerViewFactory: MarkerViewFactory) {
    super();
    this.descriptionPercentage = Math.round(100 / (descriptionRatio + 1) * descriptionRatio);
    this.dialogueSizeStyles = document.createElement('style');
    this.dialogueSizeStyles.innerHTML = `
  div.leaflet-popup-content {
      height: ${this.dialogueHeight};
      width: ${this.dialogueWidth}!important;
  }
  
  .sea-initiative-popup .sea-initiative-details {
      width: ${this.descriptionPercentage}%;
  }
  
  .sea-initiative-popup .sea-initiative-contact {
      width: ${100 - this.descriptionPercentage}%;
  }
  
  .sea-initiative-popup{
    left: calc(-${this.dialogueWidth} / 2)!important;
  }`;

  }

  createMap() {
    document.body.appendChild(this.dialogueSizeStyles);
    
    // setup map (could potentially add this to the map initialization instead)
    //world ends corners
    var corner1 = leaflet.latLng(-90, -180),
      corner2 = leaflet.latLng(90, 180),
      worldBounds = leaflet.latLngBounds(corner1, corner2);

    const osmURL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    console.log(this.presenter.getTileUrl())
    const tileMapURL = this.presenter.getTileUrl() ?? osmURL;

    let mapAttribution = this.presenter.getMapAttribution();
    mapAttribution = mapAttribution.replace('contributors', this.labels.contributers ?? '');
    mapAttribution = mapAttribution.replace('Other data', this.labels.otherData ?? '');
    mapAttribution = mapAttribution.replace("Powered by <a href='https://www.geoapify.com/'>Geoapify</a>", `<a href='https://www.geoapify.com/'>${this.labels.poweredBy ?? ''}</a>`);
    mapAttribution = mapAttribution.replace('This map contains indications of areas where there are disputes over territories. The ICA does not endorse or accept the boundaries depicted on the map.', this.labels.mapDisclaimer ?? '');
    const osmAttrib = mapAttribution;

    var eventHandlers = this.presenter.getMapEventHandlers();

    // For the contextmenu docs, see https://github.com/aratcliffe/Leaflet.contextmenu.
    this.map = leaflet.map("map-app-leaflet-map", {
      // set to true to re-enable context menu.
      // See https://github.com/SolidarityEconomyAssociation/open-data-and-maps/issues/78
      // contextmenu: false,
      // noWrap: true, // FIXME this is commented as not supported? 
      minZoom: 2,
      //set max bounds - will bounce back if user attempts to cross them
      maxBounds: worldBounds
      // contextmenuWidth: 140,
    }) as Map; // Need to coerce the type to include our loaded extension methods
    
    this.map.zoomControl.setPosition("bottomright");

    for (const key in eventHandlers) {
      const eventHandler = eventHandlers[key];
      if (eventHandler)
        this.map.on(key, eventHandler);
    }


    leaflet
      .tileLayer(tileMapURL, { attribution: osmAttrib, maxZoom: 17, noWrap: true })
      .addTo(this.map);

    const options: leaflet.MarkerClusterGroupOptions = {};
    const disableClusteringAtZoom = this.presenter.getDisableClusteringAtZoomFromConfig();
    if (disableClusteringAtZoom)
      options.disableClusteringAtZoom = disableClusteringAtZoom;

    this.unselectedClusterGroup = leaflet.markerClusterGroup(
      Object.assign(options, {
        chunkedLoading: true
      })
    );
    // Look at https://github.com/Leaflet/Leaflet.markercluster#bulk-adding-and-removing-markers for chunk loading
    this.map.addLayer(this.unselectedClusterGroup);
    this.selectedClusterGroup = leaflet.markerClusterGroup();
    this.map.addLayer(this.selectedClusterGroup);

    leaflet.Map.addInitHook(MapView.spinMapInitHook);


    var logo = this.presenter.getLogo();
    if (logo) {
      d3.select(".leaflet-top.leaflet-right")
        .append("div")
        .attr("id", "logo-holder")
        .append("img")
        .attr("src", logo)
        .attr("alt", "company logo")
        .classed("logo", true);
    }

    this.markerViewFactory.setSelectedClusterGroup(this.selectedClusterGroup);
    this.markerViewFactory.setUnselectedClusterGroup(this.unselectedClusterGroup);
  }

  removeAllMarkers() {
    this.markerViewFactory.destroyAll();
  }

  addMarker(initiative: Initiative) {
    const map = this.map;
    if (!map)
      throw new Error("Map field not yet initialised");
    return this.markerViewFactory.createMarker(map, initiative);
  }

  refreshMarker(initiative: Initiative) {
    this.markerViewFactory.refreshMarker(initiative);
  }

  setSelected(initiative: Initiative) {
    this.markerViewFactory.setSelected(initiative);
  }

  setUnselected(initiative: Initiative) {
    this.markerViewFactory.setUnselected(initiative);
  }

  showTooltip(initiative: Initiative) {
    this.markerViewFactory.showTooltip(initiative);
  }

  hideTooltip(initiative: Initiative) {
    this.markerViewFactory.hideTooltip(initiative);
  }

  setZoom(zoom: number) {
    this.map?.setZoom(zoom);
  }

  fitBounds(data: EventBus.Map.BoundsData) {
    this.map?.fitBounds(data.bounds, data.options);
  }

  getClusterGroup() {
    return this.markerViewFactory.getClusterGroup();
  }

  setView(data: EventBus.Map.ZoomData) {
    const map = this.map;
    if (!map)
      return;
    
    const options = {
      duration: 0.25
      // maxZoom: this.map.getZoom()
    };
    
    // center: LatLngExpression, zoom?: number, options?: ZoomPanOptions): this;
    map.setView(data.latlng, data.zoom, Object.assign(options, data.options));
  }

  isVisible(initiatives: Initiative[]): boolean {
    //check if whether the passed initiatives are currently visible or not
    //for each marker check if the marker is directly visible 
    //!!initative.__internal.marker && !!initative.__internal.marker._icon => marker is visible on the map
    //this.unselectedClusterGroup.getVisibleParent(initative.__internal.marker) == initative.__internal.marker => marker does not have a parent (i.e. not in a cluster)
    const group = this.unselectedClusterGroup;
    if (group)
      return initiatives.every(initiative => {
        const marker = initiative.__internal?.marker;
        if (marker instanceof leaflet.Marker)
          return group.getVisibleParent(marker) == marker;
        console.error("initiative is missing a marker reference", initiative);
        return false;
      });
    else
      return true;
  }

  boundsWithinCurrentBounds(bounds: Box2d): boolean {
    const map = this.map;
    if (!map)
      return false;
    
    //checks if the bounds passed are smaller than the current bounds
    //(north-south) and (east-west)
    let mapBounds = map.getBounds();
    //rectangle size for map
    let am = Math.abs(mapBounds.getSouth() - mapBounds.getNorth());
    let bm = Math.abs(mapBounds.getWest() - mapBounds.getEast());

    //rectangle size for passed bounds
    let a = Math.abs(bounds[0][0] - bounds[1][0]);
    let b = Math.abs(bounds[0][1] - bounds[1][1]);

    if (a <= am && b <= bm)
      return true;
    else
      return false;
  }

  flyTo(data: EventBus.Map.ZoomData) {
    const map = this.map;
    if (!map)
      return;
    const options = {
      duration: 0.25
      // maxZoom: map.getZoom()
    };
    map.flyTo(data.latlng, map.getZoom(), Object.assign(options, data.options));
  }

  flyToBounds(data: EventBus.Map.SelectAndZoomData) {
    const map = this.map;
    if (!map)
      return;
 
    const options = { duration: 0.25, maxZoom: map.getZoom() };

    //only execute zoom to bounds if initiatives in data.initiatives are not currently vissible
    //data.initiatives contains the initiatives. There are 3 cases
    //1. One marker - Marker is visible (no cluster) - pan on the marker
    //2. Multiple markers - Markers are visisible (no clusters) - pan to markers if you can without zoom, else just do the usual and zoom
    //3. Clusters within clusters
    if (data.bounds) {
      if (data.initiatives && this.isVisible(data.initiatives)
        && this.boundsWithinCurrentBounds(data.bounds)) {// all are visible
        //case 1 and 2
        //if you can contain the markers within the screen, then just pan
        // map.panTo(map.getBounds().getCenter())  ; // get center 
        //map.panTo(bounds.getBounds().getCenter())  ;
        let centre = leaflet.latLngBounds(data.bounds[0], data.bounds[1]).getCenter();
        map.panTo(centre, { animate: true });
        //pan does not trigger the open popup event though because there is no zoom event
      }
      else { //case 3
        map.flyToBounds(data.bounds, Object.assign(options, data.options)); // normal zoom/pan
      }
    }
  }

  //pass array of 1 initiative in data.initiative
  selectAndZoomOnInitiative(data: EventBus.Map.SelectAndZoomData) {
    const map = this.map;
    if (!map)
      return;
    if (!data.bounds)
      return;
    
    //const options = Object.assign({ duration: 0.25, maxZoom: this.map?.getZoom() }, data.options);
    let centre = leaflet.latLngBounds(data.bounds[0], data.bounds[1]).getCenter();
    
    //keep latitude unchanged unless the marker is less than 300 pixels from the top of the screen
    let lat = map.getCenter().lat;

    //this is from the config, so if you change the unit there you need to change it here
    const dialogueHeight = parseInt(this.dialogueHeight.split("px")[0]); // FIXME only works for pixels!

    //get a latitude that shows the whole dialogue on screen
    const mapMinY = map.getPixelBounds().min?.y ?? 0;
    const mapCenter = map.project(centre);
    if (mapCenter.y - mapMinY < dialogueHeight) {
      const point = new leaflet.Point(mapCenter.x, mapCenter.y - dialogueHeight/2);
      lat = map.unproject(point).lat;
    }

    let lngCentre = { lat: lat, lng: centre.lng };

    //make sure you pan to center the initiative on the x axis, or longitudanally.
    map.panTo(lngCentre, { animate: true });

    //trigger refresh if the marker is outside of the screen or if it's clustered
    const marker = data.initiatives[0].__internal?.marker;
    if (!(marker instanceof leaflet.Marker)) {
      console.error("initiative is missing a marker reference", data.initiatives[0]);
      return;
    }



    //zoom to layer if needed and unspiderify
    this.unselectedClusterGroup?.zoomToShowLayer(
      marker,
      () => this.presenter.onMarkersNeedToShowLatestSelection(data.initiatives)
    );
    this.unselectedClusterGroup?.refreshClusters(marker);


    //code for not destroying pop-up when zooming out
    //only execute zoom to bounds if initiatives in data.initiatives are not currently vissible
    //data.initiatives contains the initiatives. There are 3 cases
    //1. One marker - Marker is visible (no cluster) - pan on the marker
    //2. Multiple markers - Markers are visisible (no clusters) - pan to markers if you can without zoom, else just do the usual and zoom
    //3. Clusters within clusters
    // if (data.initatives && this.isVisible(data.initiatives)
    //   && this.boundsWithinCurrentBounds(bounds)) {// all are visible
    //   //case 1 and 2
    //   //if you can contain the markers within the screen, then just pan
    //   // map.panTo(map.getBounds().getCenter())  ; // get center 
    //   //map.panTo(bounds.getBounds().getCenter())  ;

    //   //pan does not trigger the open popup event though because there is no zoom event
    // }
    // else { //case 3
    //   //map.flyToBounds(bounds, options); // normal zoom/pan
    // }
    // map.setView( map.getBounds().getCenter(),  map.getZoom() - 1, { animate: false });
    // map.setView( map.getBounds().getCenter(),  map.getZoom() + 1, { animate: false });

    // let that = this;

    // map.once('moveend', function () {
    //         //should check for firefox only before refresh? TODO
    //   if (!that.flag) {
    //     console.log("false flag");
    //     that.flag = true;
    //     //we refresh the screen once
    //     //to make sure we do not get recurrsion due to the setview coming inside the same moveend event
    //     //we use a flag
    //     this.setView(this.getBounds().getCenter(), this.getZoom() + 1, { animate: false }); //what will this do?
    //     //we release the flag after the refresh is made and we pop-up the initative
    //     this.once('moveend', function () {
    //       that.flag = false;
    //       console.log("start select");
    //       that.presenter.onMarkersNeedToShowLatestSelection({ selected: data.initiatives });
    //     });
    //   }
    // });

    // map.fire("resize");
    // map.invalidateSize();


  }

  zoomAndPanTo(latLng: leaflet.LatLngExpression) {
    console.log("zoomAndPanTo");
    this.map?.setView(latLng, 16, { animate: true });
  }

  startLoading(error?: EventBus.Initiatives.DatasetError) {
    const text = `${this.labels.loading}...`;
    const container = "#map-app-leaflet-map";
    const id = "loadingCircle";

    //example loading
    //with css
    //could look a lot better, with svgs
    if (error) {
      console.error(error);
      d3.select("#" + id).style('display', 'none');
      d3.select("#" + id + "txt").text(`${this.labels.errorLoading ?? ''} - id: ${error.dataset ?? '<?>'}`);
    }
    else {
      let loading = d3.select('#' + id);
      if (loading.empty()) {
        // Create the node if it is missing
        const loading2 = d3.select(container).append("div");
        loading2.attr("id", id);
        loading2.append("div").attr("id", id + "spin");
        loading2.append("p").attr("id", id + "txt");
        loading2.style('display', 'block');
      }
      else
        // Ensure node is displayed
        loading.style('display', 'block');
      
      //edit text
      d3.select("#" + id + "txt").text(text);
    }
  }

  stopLoading() {
    d3.select('#loadingCircle').style('display', 'none');
  }



  
  setActiveArea(offset: number) {
    if (this._settingActiveArea) return;
    this.map?.once("moveend", () => {
      this._settingActiveArea = false;
    });
    this._settingActiveArea = true;
    let css = {
      position: "absolute",
      top: "20px",
      left: offset + "px",
      right: '0',
      bottom: '0'
    };

    // Hovering the sidebar open/close button seems to trigger this to. Check for this and return
    // if (!data.target.id) return;
    
    const refocusMap = true;
    const animateRefocus = true;
    this.map?.setActiveArea(css, refocusMap, animateRefocus);
  }

}


