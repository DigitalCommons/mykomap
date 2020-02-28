define([
  "d3",
  "leaflet",
  "leafletActiveArea",
  "leaflet.contextmenu",
  "view/base",
  "presenter/map",
  "view/map/marker"
], function(
  d3,
  leaflet,
  activeArea,
  contextmenu,
  viewBase,
  presenter,
  markerView
) {
  "use strict";

  const config = {
    putSelectedMarkersInClusterGroup: false
  };

  function loader(config) {
    return function() {
      //example loading
      //with css
      //could look a lot better, with svgs
      if(config.error)
      {
        d3.select("#"+config.id).remove();
        d3.select("#"+config.id+"spin").remove();
        d3.select("#"+config.id+"txt").text("Error loading " + config.text + " data :(");
      }
      else {
        if(d3.select(config.id).empty()){
          //create new
          let loading  = d3.select(config.container).append("div");
          loading.append("div").attr("id",config.id+"spin");
          loading.append("p").text("Loading " + config.text + " Data..").attr("id",config.id+"txt");
        }
        else {
          //edit text
          d3.select(config.id+"txt").text(config.text);
        }
      }

      
    };
  }

  function stopLoader(config){
    return function() {
      //example loading
      //with css
      //could look a lot better
      d3.select(config.id).remove();
      d3.select(config.id+"spin").remove();
      d3.select(config.id+"txt").remove();

    };
  }
  
  var SpinMapMixin = {
    seaLoading: function (state, options) {
        if (!!state) {
          options.datasetLoading = 
          options.datasetLoading.charAt(0).toUpperCase() + options.datasetLoading.slice(1);
          
          var myLoader = loader({error:options.error,text:options.datasetLoading, container: "#map-app-leaflet-map", id: "loadingCircle"});
          myLoader();
          }
        else {
         var myStopLoader = stopLoader({id:"#loadingCircle"});
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
        e.layer.on('data:loaded',  function () {
        }, this);
    }, this);
    this.on('layerremove', function (e) {
        // Clean-up
        if (typeof e.layer.on !== 'function') return;
        e.layer.off('data:loaded');
        e.layer.off('data:loading');
    }, this);
}; 

  function MapView() {}
  // inherit from the standard view base object:
  var proto = Object.create(viewBase.base.prototype);
  proto.createMap = function() {
    const openCycleMapUrl =
      "http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png";
    const osmUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const osmAttrib =
      'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';
    var i,
      eventHandlers = this.presenter.getMapEventHandlers();
    var k = Object.keys(eventHandlers);
    // For the contextmenu docs, see https://github.com/aratcliffe/Leaflet.contextmenu.
    this.map = leaflet.map("map-app-leaflet-map", {
      // set to true to re-enable context menu.
      // See https://github.com/SolidarityEconomyAssociation/open-data-and-maps/issues/78
      contextmenu: false
      // contextmenuWidth: 140,
      // contextmenuItems: this.presenter.getContextmenuItems()
    });
    this.map.zoomControl.setPosition("bottomright");

    window.seaMap = this.map;

    // Get the initial bounds from config
    let initialBounds = this.presenter.getInitialBounds();
    if (initialBounds) this.map.fitBounds(initialBounds);

    for (i = 0; i < k.length; ++i) {
      this.map.on(k[i], eventHandlers[k[i]]);
    }

    leaflet
      .tileLayer(osmUrl, { attribution: osmAttrib, maxZoom: 18 })
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



    markerView.setSelectedClusterGroup(this.selectedClusterGroup);
    markerView.setUnselectedClusterGroup(this.unselectedClusterGroup);

    // var that = this;

    // this.map.on("zoomend", e => {
    //   console.log(this.map.selectedInitiative);
    //   if (this.map.selectedInitiative)
    //     markerView.setSelected(this.map.selectedInitiative);
    // });
  };
  proto.removeAllMarkers = function() {
    
    markerView.destroyAll();
  };
  proto.addMarker = function(initiative) {
    return markerView.createMarker(this.map, initiative);
  };
  proto.setSelected = function(initiative) {
    markerView.setSelected(initiative);
  };
  proto.setUnselected = function(initiative) {
    markerView.setUnselected(initiative);
  };
  proto.showTooltip = function(initiative) {
    markerView.showTooltip(initiative);
  };
  proto.hideTooltip = function(initiative) {
    markerView.hideTooltip(initiative);
  };
  proto.setZoom = function(zoom) {
    this.map.setZoom(zoom);
  };
  proto.fitBounds = function(data) {
    let bounds = data,
      options = {};
    if (!Array.isArray(data)) {
      bounds = data.bounds;
      options = data.options;
    }
    this.map.fitBounds(bounds, options);
  };
  proto.getClusterGroup = function() {
    return markerView.getClusterGroup();
  };

  proto.setView = function(data) {
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

  proto.flyTo = function(data) {
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

  proto.flyToBounds = function(data) {
    let bounds = data,
      options = { duration: 0.25, maxZoom: this.map.getZoom() };
    if (!Array.isArray(data)) {
      bounds = data.bounds;
      options = Object.assign(options, data.options);
    }
    this.map.flyToBounds(bounds, options);
  };

  proto.zoomAndPanTo = function(latLng) {
    console.log("zoomAndPanTo");
    this.map.setView(latLng, 16, { animate: true });
  };

  proto.startLoading = function(data){
    this.map.seaLoading(true,{datasetLoading:data.dataset,error:data.error});
  };

  proto.stopLoading = function(){
    this.map.seaLoading(false);

  }

  proto.setActiveArea = function(data) {
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
    console.log(css);
    this.map.setActiveArea(css, refocusMap, animateRefocus);
  };

  MapView.prototype = proto;
  function init() {
    const view = new MapView();
    view.setPresenter(presenter.createPresenter(view));
    view.createMap();
    return view;
  }
  var pub = {
    init: init
  };
  return pub;
});
