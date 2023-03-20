import { MapPresenter } from "../presenter/map";
import { BaseView } from './base';
import { Map } from '../map';
import * as d3 from 'd3';
import * as leaflet from 'leaflet';

import { Initiative } from "../model/initiative";
import { EventBus } from "../../eventbus";
import { MarkerManager } from "../marker-manager";
import { PhraseBook } from "../../localisations";
import { Box2d } from "../../common-types";
import { isFiniteBox2d } from "../../utils";

export class MapView extends BaseView {
  map?: Map;
  private _settingActiveArea: boolean = false;
  private readonly descriptionPercentage: number;
  private readonly dialogueSizeStyles: HTMLStyleElement;
  private readonly dialogueHeight;
  private readonly dialogueWidth;
  private readonly labels: PhraseBook;
  private readonly markers: MarkerManager;
  selectedClusterGroup?: leaflet.MarkerClusterGroup;
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

  private static copyTextToClipboard(text: string) {
    const body = d3.select(document.body)
    const textArea = body.append("textarea")
      .attr(
        "style",
        // Place in top-left corner of screen regardless of scroll position.
        "position: fixed; top: 0; left: 0; "+
          // Ensure it has a small width and height. Setting to 1px / 1em
          // doesn't work as this gives a negative w/h on some browsers.
          "width: 2em; height: 2em; "+
          // We don't need padding, reducing the size if it does flash render.
          "padding: 0; "+
          // Clean up any borders.          
          "border: none; outline: none; box-shadow: none; "+
          // Avoid flash of white box if rendered for any reason.
          "background: transparent"
           )
      .attr("value", text)
    
    // ***taken from https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript?page=1&tab=votes#tab-top ***
    //
    // *** This styling is an extra step which is likely not required. ***
    //
    // Why is it here? To ensure:
    // 1. the element is able to have focus and selection.
    // 2. if element was to flash render it has minimal visual impact.
    // 3. less flakyness with selection and copying which **might** occur if
    //    the textarea element is not visible.
    //
    // The likelihood is the element won't even render, not even a
    // flash, so some of these are just precautions. However in
    // Internet Explorer the element is visible whilst the popup
    // box asking the user for permission for the web page to
    // copy to the clipboard.
    //

    textArea.node()?.focus();
    textArea.node()?.select();

    try {
      document.execCommand('copy'); // FIXME this method has been deprecated!
    } catch (err) {
      console.log('Oops, unable to copy', err);
    }

    textArea.remove()
  }

  
  /// Initialises the view, but does not create the map yet.
  ///
  /// To do that, call #createMap
  constructor(readonly presenter: MapPresenter) {
    super();

    this.labels = presenter.mapUI.dataServices.getFunctionalLabels();
    this.markers = presenter.mapUI.markers;

    const dialogueSize = presenter.mapUI.dataServices.getDialogueSize();
    this.dialogueHeight = dialogueSize.height ?? '225px'; // MUST BE IN PX
    this.dialogueWidth = dialogueSize.width ?? '35vw';
    const descriptionRatio: number = dialogueSize.descriptionRatio ?? 2.5;

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

  private onInitiativeClicked(me: leaflet.LeafletMouseEvent): void {
    // Deselect any selected markers        
    if (me.originalEvent.ctrlKey && me.latlng) {
      MapView.copyTextToClipboard(me.latlng.lat + "," + me.latlng.lng);
    }
    this.presenter.onInitiativeClicked();
  }
  
  private onLoad(_: leaflet.LeafletEvent) {
    this.presenter.onLoad();
  }
  
  private onResize(_: leaflet.ResizeEvent) {
    this.map?.invalidateSize();
    console.log("Map resize", window.outerWidth);
  }



  createMap(mapAttribution: string, disableClusteringAtZoom: number|false, tileUrl?: string): Map {
    document.body.appendChild(this.dialogueSizeStyles);
    
    // setup map (could potentially add this to the map initialization instead)
    //world ends corners
    var corner1 = leaflet.latLng(-90, -180),
      corner2 = leaflet.latLng(90, 180),
      worldBounds = leaflet.latLngBounds(corner1, corner2);

    const osmURL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    console.log(tileUrl)
    const tileMapURL = tileUrl ?? osmURL;

    mapAttribution = mapAttribution.replace('contributors', this.labels.contributers);
    mapAttribution = mapAttribution.replace('Other data', this.labels.otherData);
    mapAttribution = mapAttribution.replace("Powered by <a href='https://www.geoapify.com/'>Geoapify</a>", `<a href='https://www.geoapify.com/'>${this.labels.poweredBy}</a>`);
    mapAttribution = mapAttribution.replace('This map contains indications of areas where there are disputes over territories. The ICA does not endorse or accept the boundaries depicted on the map.', this.labels.mapDisclaimer);
    const osmAttrib = mapAttribution;


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

    this.map.on('click', (e) => this.onInitiativeClicked(e));
    this.map.on('load', (e) => this.onLoad(e));
    this.map.on('resize', (e) => this.onResize(e));
    
    leaflet
      .tileLayer(tileMapURL, { attribution: osmAttrib, maxZoom: 17, noWrap: true })
      .addTo(this.map);

    const options: leaflet.MarkerClusterGroupOptions = {};

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

    const initialBounds = this.presenter.mapUI.config.getInitialBounds();
    if (initialBounds)
      this.map.fitBounds(initialBounds);
    
    return this.map;
  }

  fitBounds(data: EventBus.Map.BoundsData) {
    this.map?.fitBounds(data.bounds, data.options);
  }

  getClusterGroup() {
    return this.markers.getClusterGroup();
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
      if (!isFiniteBox2d(data.bounds)) {
        console.log("ignoring non-finite bounds", data.bounds);
        return;
      }
      
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
      d3.select("#" + id + "txt").text(`${this.labels.errorLoading} - id: ${error.dataset ?? '<?>'}`);
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
