"use strict";

import { Dictionary } from "../../common_types";
import { DialogueSize } from "../model/config_schema";
import { MapPresenter, MapPresenterFactory } from "../presenter/map";
import { MarkerViewFactory } from "./map/marker";
import {  BaseView  } from './base';

import * as d3 from 'd3';
import * as leaflet from 'leaflet';
import * as activeArea from 'leaflet-active-area';
import * as contextmenu from 'leaflet-contextmenu';

/* This code is needed to properly load the stylesheet, and images in the Leaflet CSS */
import * as leafletCss from 'leaflet/dist/leaflet.css';

delete leaflet.Icon.Default.prototype._getIconUrl;
leaflet.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface LoaderConfig {
  error: string;
  text: string;
  container: string;
  id: string;
}

export class MapView extends BaseView {
  readonly presenter: MapPresenter;
  
  map;
  private flag: boolean = false;
  private _settingActiveArea: boolean = false;
  private readonly descriptionPercentage: number;
  private readonly dialogueSizeStyles: HTMLStyleElement;
  private readonly _config: { putSelectedMarkersInClusterGroup: boolean } = {
    putSelectedMarkersInClusterGroup: false
  };

  /// Initialises the view, but does not create the map yet.
  ///
  /// To do that, call #createMap
  constructor(mapPresenterFactory: MapPresenterFactory,
              readonly labels: Dictionary,
              readonly dialogueHeight: string = '225px',
              readonly dialogueWidth: string = '35vw',
              readonly descriptionRatio: number = 2.5,
              readonly markerViewFactory: MarkerViewFactory) {
    super();
    this.presenter = mapPresenterFactory.createPresenter(this);
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
    
    const loader = (config: LoaderConfig) => {
      return () => {
        //example loading
        //with css
        //could look a lot better, with svgs
        if (config.error) {
          d3.select("#" + config.id).style('display', 'none');
          d3.select("#" + config.id + "txt").text("Error loading: " + config.text);
        }
        else {
          let loading = d3.select('#' + config.id);
          if (loading.empty()) {
            // Create the node if it is missing
            const loading2 = d3.select(config.container).append("div");
            loading2.attr("id", config.id);
            loading2.append("div").attr("id", config.id + "spin");
            loading2.append("p").attr("id", config.id + "txt");
            loading2.style('display', 'block');
          }
          else
            // Ensure node is displayed
            loading.style('display', 'block');

          //edit text
          d3.select("#" + config.id + "txt").text(config.text);
        }
      };
    }

    const stopLoader = (config: { id: string }) => {
      return () => {
        //example loading
        //with css
        //could look a lot better
        d3.select('#' + config.id).style('display', 'none');
      };
    }

    const SpinMapMixin = {
      seaLoading: (state: boolean, options: { error: string }) => {
        if (!!state) {
          var myLoader = loader({
            error: options.error,
            text: `${this.labels.loading}...`,
            container: "#map-app-leaflet-map", id: "loadingCircle",
          });
          myLoader();
        }
        else {
          var myStopLoader = stopLoader({ id: "loadingCircle" });
          myStopLoader();
        }
      }
    };


    //experiments
    const SpinMapInitHook = function() {
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
    };

    // setup map (could potentially add this to the map initialization instead)
    //world ends corners
    var corner1 = leaflet.latLng(-90, -180),
      corner2 = leaflet.latLng(90, 180),
      worldBounds = leaflet.latLngBounds(corner1, corner2);

    const openCycleMapUrl =
      "http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png";
    const osmURL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    console.log(this.presenter.getTileUrl())
    const tileMapURL = this.presenter.getTileUrl() ? this.presenter.getTileUrl() : osmURL;

    let mapAttribution = this.presenter.getMapAttribution();
    mapAttribution = mapAttribution.replace('contributors', this.labels.contributers);
    mapAttribution = mapAttribution.replace('Other data', this.labels.otherData);
    mapAttribution = mapAttribution.replace("Powered by <a href='https://www.geoapify.com/'>Geoapify</a>", `<a href='https://www.geoapify.com/'>${this.labels.poweredBy}</a>`);
    mapAttribution = mapAttribution.replace('This map contains indications of areas where there are disputes over territories. The ICA does not endorse or accept the boundaries depicted on the map.', this.labels.mapDisclaimer);
    const osmAttrib = mapAttribution;

    var i,
      eventHandlers = this.presenter.getMapEventHandlers();
    var k = Object.keys(eventHandlers);
    // For the contextmenu docs, see https://github.com/aratcliffe/Leaflet.contextmenu.
    this.map = leaflet.map("map-app-leaflet-map", {
      // set to true to re-enable context menu.
      // See https://github.com/SolidarityEconomyAssociation/open-data-and-maps/issues/78
      contextmenu: false,
      noWrap: true,
      minZoom: 2,
      //set max bounds - will bounce back if user attempts to cross them
      maxBounds: worldBounds
      // contextmenuWidth: 140,
    });
    this.map.zoomControl.setPosition("bottomright");

    window.mykoMap = this.map;


    for (i = 0; i < k.length; ++i) {
      this.map.on(k[i], eventHandlers[k[i]]);
    }


    leaflet
      .tileLayer(tileMapURL, { attribution: osmAttrib, maxZoom: 17, noWrap: true })
      .addTo(this.map);

    let options = {},
      disableClusteringAtZoom = this.presenter.getDisableClusteringAtZoomFromConfig();
    if (disableClusteringAtZoom)
      options.disableClusteringAtZoom = disableClusteringAtZoom;

    this.unselectedClusterGroup = leaflet.markerClusterGroup(
      Object.assign(options, {
        chunkedLoading: true
      })
    );
    // Look at https://github.com/Leaflet/Leaflet.markercluster#bulk-adding-and-removing-markers for chunk loading
    this.map.addLayer(this.unselectedClusterGroup);
    if (this._config.putSelectedMarkersInClusterGroup) {
      this.selectedClusterGroup = leaflet.markerClusterGroup();
      this.map.addLayer(this.selectedClusterGroup);
    } else {
      // If we're here, then selectedClusterGroup is a BAD NAME for this property!
      this.selectedClusterGroup = this.map;
    }

    leaflet.Map.include(SpinMapMixin);
    leaflet.Map.addInitHook(SpinMapInitHook);


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

  addMarker(initiative) {
    return this.markerViewFactory.createMarker(this.map, initiative);
  }

  refreshMarker(initiative) {
    this.markerViewFactory.refreshMarker(initiative);
  }

  setSelected(initiative) {
    this.markerViewFactory.setSelected(initiative);
  }

  setUnselected(initiative) {
    this.markerViewFactory.setUnselected(initiative);
  }

  showTooltip(initiative) {
    this.markerViewFactory.showTooltip(initiative);
  }

  hideTooltip(initiative) {
    this.markerViewFactory.hideTooltip(initiative);
  }

  setZoom(zoom) {
    this.map.setZoom(zoom);
  }

  fitBounds(data) {
    let bounds = data,
      options = {};
    if (!Array.isArray(data)) {
      bounds = data.bounds;
      options = data.options;
    }
    this.map.fitBounds(bounds, options);
  }

  getClusterGroup() {
    return this.markerViewFactory.getClusterGroup();
  }

  //fix for firefox, this triggers tiles to re-render
  refresh(centre = this.map.getBounds().getCenter()) {

    this.map.invalidateSize();
    this.map.setView(centre, this.map.getZoom() - 1, { animate: false });
    this.map.setView(centre, this.map.getZoom() + 1, { animate: false });
  }

  // getZoom(){
  //   return this
  // }

  setView(data) {
    let latlng = data,
      zoom = this.map.getZoom(),
      options = {
        duration: 0.25
        // maxZoom: this.map.getZoom()
      };
    if (!Array.isArray(data)) {
      latlng = data.latlng;
      options = Object.assign(options, data.options);
    }
    this.map.setView(latlng);
  }

  isVisible(initiatives) {
    //check if whether the passed initiatives are currently visible or not
    //for each marker check if the marker is directly visible 
    //!!initative.__internal.marker && !!initative.__internal.marker._icon => marker is visible on the map
    //this.unselectedClusterGroup.getVisibleParent(initative.__internal.marker) == initative.__internal.marker => marker does not have a parent (i.e. not in a cluster)
    return initiatives.every((initative) => this.unselectedClusterGroup.getVisibleParent(initative.__internal.marker) == initative.__internal.marker);

  }

  boundsWithinCurrentBounds(bounds) {
    //checks if the bounds passed are smaller than the current bounds
    //(north-south) and (east-west)
    let mapBounds = this.map.getBounds();
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

  flyTo(data) {
    let latlng = data,
      options = {
        duration: 0.25
        // maxZoom: this.map.getZoom()
      };
    if (!Array.isArray(data)) {
      latlng = data.latlng;
      options = Object.assign(options, data.options);
    }
    this.map.flyTo(latlng, this.map.getZoom(), options);
  }

  flyToBounds(data) {
    let bounds = data,
      options = { duration: 0.25, maxZoom: this.map.getZoom() };

    if (!Array.isArray(data)) {
      bounds = data.bounds;
      options = Object.assign(options, data.options);
    }
    //only execute zoom to bounds if initiatives in data.initiatives are not currently vissible
    //data.initiatives contains the initiatives. There are 3 cases
    //1. One marker - Marker is visible (no cluster) - pan on the marker
    //2. Multiple markers - Markers are visisible (no clusters) - pan to markers if you can without zoom, else just do the usual and zoom
    //3. Clusters within clusters
    if (data.initiatives && this.isVisible(data.initiatives)
      && this.boundsWithinCurrentBounds(bounds)) {// all are visible
      //case 1 and 2
      //if you can contain the markers within the screen, then just pan
      // this.map.panTo(this.map.getBounds().getCenter())  ; // get center 
      //this.map.panTo(bounds.getBounds().getCenter())  ;
      let centre = leaflet.latLngBounds(bounds[0], bounds[1]).getCenter();
      this.map.panTo(centre, { animate: true });
      //pan does not trigger the open popup event though because there is no zoom event
    }
    else { //case 3
      this.map.flyToBounds(bounds, options); // normal zoom/pan
    }

    //should check for firefox only? TODO
    //refresh the screen to handle rendering bugs (missing tiles or markers)
    var refresh = () => {
      if (!this.flag) {
        this.flag = true;
        this.map.off('moveend', refresh);
        this.map.off('animationend', refresh)
        this.refresh();
        this.flag = false;
      }
    }

    this.map.on('moveend', refresh);
    this.map.on('animationend', refresh)

  }

  //pass array of 1 initiative in data.initiative
  selectAndZoomOnInitiative(data) {
    let bounds = data,
      options = { duration: 0.25, maxZoom: this.map.getZoom() };
    if (!Array.isArray(data)) {
      bounds = data.bounds;
      options = Object.assign(options, data.options);
    }
    let centre = leaflet.latLngBounds(bounds[0], bounds[1]).getCenter();

    //keep latitude unchanged unless the marker is less than 300 pixels from the top of the screen
    let lat = this.map.getCenter().lat;

    //this is from the config, so if you change the unit there you need to change it here
    const dialogueHeight = parseInt(this.dialogueHeight.split("px"));

    //get a latitude that shows the whole dialogue on screen
    if (this.map.project(centre).y - this.map.getPixelBounds().min.y < dialogueHeight) {
      lat = this.map.unproject({
        x: this.map.project(centre).x,
        y: this.map.project(centre).y - (dialogueHeight / 2)
      }).lat;
    }

    let lngCentre = { lat: lat, lng: centre.lng };

    //make sure you pan to center the initiative on the x axis, or longitudanally.
    this.map.panTo(lngCentre, { animate: true });

    //trigger refresh if the marker is outside of the screen or if it's clustered
    if (!this.map.getBounds().contains(data.initiatives[0].__internal.marker.getLatLng()) || !this.isVisible(data.initiatives))
      this.refresh(centre);



    //zoom to layer if needed and unspiderify
    this.unselectedClusterGroup.zoomToShowLayer(data.initiatives[0].__internal.marker, (m) =>
      this.presenter.onMarkersNeedToShowLatestSelection({ selected: data.initiatives }));
    this.unselectedClusterGroup.refreshClusters(data.initiatives[0].__internal.marker);


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
    //   // this.map.panTo(this.map.getBounds().getCenter())  ; // get center 
    //   //this.map.panTo(bounds.getBounds().getCenter())  ;

    //   //pan does not trigger the open popup event though because there is no zoom event
    // }
    // else { //case 3
    //   //this.map.flyToBounds(bounds, options); // normal zoom/pan
    // }
    // this.map.setView( this.map.getBounds().getCenter(),  this.map.getZoom() - 1, { animate: false });
    // this.map.setView( this.map.getBounds().getCenter(),  this.map.getZoom() + 1, { animate: false });

    // let that = this;

    // this.map.once('moveend', function () {
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

    // this.map.fire("resize");
    // this.map.invalidateSize();


  }

  zoomAndPanTo(latLng) {
    console.log("zoomAndPanTo");
    this.map.setView(latLng, 16, { animate: true });
  }

  startLoading(data: { message: string, error?: string }) {
    this.map.seaLoading(true, data.error && { error: data.error });
  }

  stopLoading() {
    this.map.seaLoading(false);

  }

  setActiveArea(data: { offset: number }) {
    if (this._settingActiveArea) return;
    window.mykoMap.once("moveend", () => {
      this._settingActiveArea = false;
    });
    this._settingActiveArea = true;
    let css = {
      position: "absolute",
      top: "20px",
      left: data.offset + "px",
      right: 0,
      bottom: 0
    };

    // Hovering the sidebar open/close button seems to trigger this to. Check for this and return
    // if (!data.target.id) return;

    const refocusMap = true,
      animateRefocus = true;
    this.map.setActiveArea(css, refocusMap, animateRefocus);
  }

}


