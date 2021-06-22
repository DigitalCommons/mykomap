"use strict";
const d3 = require('d3');
const leaflet = require('leaflet');
const activeArea = require('leaflet-active-area');
const contextmenu = require('leaflet-contextmenu');



/* This code is needed to properly load the stylesheet, and images in the Leaflet CSS */
const leafletCss = require('leaflet/dist/leaflet.css');
delete leaflet.Icon.Default.prototype._getIconUrl;
leaflet.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});



function init(registry) {
  const _config = registry('config');
  const presenter = registry('presenter/map');
  const markerView = registry('view/map/marker');
  const viewBase = registry('view/base');
  const sseInitiative = registry('model/sse_initiative');

  const labels = sseInitiative.getFunctionalLabels();

  const config = {
    putSelectedMarkersInClusterGroup: false
  };

  const dialogueSize = sseInitiative.getDialogueSize();

  const descriptionRatio = parseInt(dialogueSize.descriptionRatio);
  const descriptionPercentage = Math.round(100 / (descriptionRatio + 1) * descriptionRatio);

  const dialogueSizeStyles = document.createElement('style');
  dialogueSizeStyles.innerHTML = `
  div.leaflet-popup-content {
      height: ${dialogueSize.height};
      width: ${dialogueSize.width}!important;
  }
  
  .sea-initiative-popup .sea-initiative-details {
      width: ${descriptionPercentage}%;
  }
  
  .sea-initiative-popup .sea-initiative-contact {
      width: ${100 - descriptionPercentage}%;
  }
  
  .sea-initiative-popup{
    left: ${-parseInt(dialogueSize.width.split("v")[0])/2}vw!important;
  }`;

  document.body.appendChild(dialogueSizeStyles);

  function loader(config) {
    return function () {
      //example loading
      //with css
      //could look a lot better, with svgs
      if (config.error) {
        d3.select("#" + config.id).remove();
        d3.select("#" + config.id + "spin").remove();
        d3.select("#" + config.id + "txt").text("Error loading " + config.text + " data :(");
      }
      else {
        if (d3.select(config.id).empty()) {
          //create new
          let loading = d3.select(config.container).append("div");
          loading.append("div").attr("id", config.id + "spin");
          loading.append("p").text("Loading " + config.text + " Data..").attr("id", config.id + "txt");
        }
        else {
          //edit text
          d3.select(config.id + "txt").text(config.text);
        }
      }


    };
  }

  function stopLoader(config) {
    return function () {
      //example loading
      //with css
      //could look a lot better
      d3.select(config.id).remove();
      d3.select(config.id + "spin").remove();
      d3.select(config.id + "txt").remove();

    };
  }

  var SpinMapMixin = {
    seaLoading: function (state, options) {
      if (!!state) {
        options.datasetLoading =
          options.datasetLoading.charAt(0).toUpperCase() + options.datasetLoading.slice(1);

        var myLoader = loader({ error: options.error, text: options.datasetLoading, container: "#map-app-leaflet-map", id: "loadingCircle" });
        myLoader();
      }
      else {
        var myStopLoader = stopLoader({ id: "#loadingCircle" });
        myStopLoader();
      }
    }
  };


  //experiments
  var SpinMapInitHook = function () {
    this.on('layeradd', function (e) {
      // If added layer is currently loading, spin !
      if (typeof e.layer.on !== 'function') return;
      e.layer.on('data:loading', function () {
      }, this);
      e.layer.on('data:loaded', function () {
      }, this);
    }, this);
    this.on('layerremove', function (e) {
      // Clean-up
      if (typeof e.layer.on !== 'function') return;
      e.layer.off('data:loaded');
      e.layer.off('data:loading');
    }, this);
  };

  function MapView() { }
  // inherit from the standard view base object:
  var proto = Object.create(viewBase.base.prototype);
  proto.createMap = function () {
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
    mapAttribution = mapAttribution.replace('contributors',labels.contributers);
    mapAttribution = mapAttribution.replace('Other data',labels.otherData);
    mapAttribution = mapAttribution.replace('Powered by',labels.poweredBy);
    mapAttribution = mapAttribution.replace('This map contains indications of areas where there are disputes over territories. The ICA does not endorse or accept the boundaries depicted on the map.',labels.mapDisclaimer);
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

    window.seaMap = this.map;


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
    if (config.putSelectedMarkersInClusterGroup) {
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

    markerView.setSelectedClusterGroup(this.selectedClusterGroup);
    markerView.setUnselectedClusterGroup(this.unselectedClusterGroup);

    // var that = this;

    // this.map.on("zoomend", e => {
    //   console.log(this.map.selectedInitiative);
    //   if (this.map.selectedInitiative)
    //     markerView.setSelected(this.map.selectedInitiative);
    // });
  };
  proto.removeAllMarkers = function () {

    markerView.destroyAll();
  };
  proto.addMarker = function (initiative) {
    return markerView.createMarker(this.map, initiative);
  };
  proto.refreshMarker = function (initiative) {
    markerView.refreshMarker(initiative);
  };
  proto.setSelected = function (initiative) {
    markerView.setSelected(initiative);
  };
  proto.setUnselected = function (initiative) {
    markerView.setUnselected(initiative);
  };
  proto.showTooltip = function (initiative) {
    markerView.showTooltip(initiative);
  };
  proto.hideTooltip = function (initiative) {
    markerView.hideTooltip(initiative);
  };
  proto.setZoom = function (zoom) {
    this.map.setZoom(zoom);
  };
  proto.fitBounds = function (data) {
    let bounds = data,
        options = {};
    if (!Array.isArray(data)) {
      bounds = data.bounds;
      options = data.options;
    }
    this.map.fitBounds(bounds, options);
  };
  proto.getClusterGroup = function () {
    return markerView.getClusterGroup();
  };
  //fix for firefox, this triggers tiles to re-render
  proto.refresh = function (centre = this.map.getBounds().getCenter()) {

    this.map.invalidateSize();
    this.map.setView(centre, this.map.getZoom() - 1, { animate: false });
    this.map.setView(centre, this.map.getZoom() + 1, { animate: false });

    console.log("refreshed")
  }

  // proto.getZoom = function (){
  //   return this
  // }
  proto.setView = function (data) {
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
  };


  proto.isVisible = function (initiatives) {
    //check if whether the passed initiatives are currently visible or not
    //for each marker check if the marker is directly visible 
    //!!initative.marker && !!initative.marker._icon => marker is visible on the map
    //this.unselectedClusterGroup.getVisibleParent(initative.marker) == initative.marker => marker does not have a parent (i.e. not in a cluster)
    return initiatives.every((initative) => this.unselectedClusterGroup.getVisibleParent(initative.marker) == initative.marker);

  };
  proto.boundsWithinCurrentBounds = function (bounds) {
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
  };

  proto.flyTo = function (data) {
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
  };



  let flag = false;
  proto.flyToBounds = function (data) {
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
    let that = this;

    //refresh the screen to handle rendering bugs (missing tiles or markers)
    var refresh = () => {
      if (!that.flag) {
        that.flag = true;
        that.map.off('moveend', refresh);
        that.map.off('animationend', refresh)
        that.refresh();
        that.flag = false;
      }
    }

    this.map.on('moveend', refresh);
    this.map.on('animationend', refresh)

  };

  //pass array of 1 initiative in data.initiative
  proto.selectAndZoomOnInitiative = function (data) {
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
    const dialogueHeight = parseInt(dialogueSize.height.split("px"));

    //get a latitude that shows the whole dialogue on screen
    if(this.map.project(centre).y - this.map.getPixelBounds().min.y < dialogueHeight){
      lat = this.map.unproject({
        x: this.map.project(centre).x,
        y: this.map.project(centre).y - (dialogueHeight / 2)
      }).lat;
    }

    let lngCentre = {lat: lat, lng: centre.lng};

    //make sure you pan to center the initiative on the x axis, or longitudanally.
    this.map.panTo(lngCentre, { animate: true });

    //trigger refresh if the marker is outside of the screen or if it's clustered
    if (!this.map.getBounds().contains(data.initiatives[0].marker.getLatLng()) || !this.isVisible(data.initiatives))
      this.refresh(centre);



    //zoom to layer if needed and unspiderify
    this.unselectedClusterGroup.zoomToShowLayer(data.initiatives[0].marker, (m) =>
      this.presenter.onMarkersNeedToShowLatestSelection({ selected: data.initiatives }));
    this.unselectedClusterGroup.refreshClusters(data.initiatives[0].marker);


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


  };









  proto.zoomAndPanTo = function (latLng) {
    console.log("zoomAndPanTo");
    this.map.setView(latLng, 16, { animate: true });
  };

  proto.startLoading = function (data) {
    this.map.seaLoading(true, { datasetLoading: data.dataset, error: data.error });
  };

  proto.stopLoading = function () {
    this.map.seaLoading(false);

  }

  proto.setActiveArea = function (data) {
    if (this._settingActiveArea) return;
    window.seaMap.once("moveend", () => {
      this._settingActiveArea = undefined;
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
  };

  MapView.prototype = proto;
  function init() {
    const view = new MapView();
    view.setPresenter(presenter.createPresenter(view));
    view.createMap();
    return view;
  }
  return {
    init: init
  };
}

module.exports = init;
