"use strict";
const leaflet = require('leaflet');
const leafletMarkerCluster = require('leaflet.markercluster');
const leafletAwesomeMarkers = require('leaflet.awesome-markers');
const eventbus = require('../../eventbus');
const { MapMarkerPresenter } = require('../../presenter/map/marker');
const { BaseView } = require('../base');

export class MapMarkerView extends BaseView {
  // Using font-awesome icons, the available choices can be seen here:
  // http://fortawesome.github.io/Font-Awesome/icons/
  dfltOptions = { prefix: "fa" }; // "fa" selects the font-awesome icon set (we have no other)

  
  constructor(presenter, map, initiative, defaultLatLng, mapMarkerViewFactory) {
    super();
    this.defaultLatLng = defaultLatLng;
    this.factory = mapMarkerViewFactory;
    this.initiative = initiative;
    this.mapObj = map;
    this.setPresenter(presenter); // required before the following code is executed.

    // options argument overrides our default options:
    const opts = Object.assign(this.dfltOptions, {
      // icon: this.presenter.getIcon(initiative),
      popuptext: this.presenter.getInitiativeContent(initiative)
      // hovertext: this.presenter.getHoverText(initiative),
      // cluster: true,
      // markerColor: this.presenter.getMarkerColor(initiative)
    });

    // For non-geo initiatives we don't need a marker but still want to get the initiativeContent
    // TODO: Content generation should live somewhere else.
    // const ukPostcode = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;
    if (!initiative.hasLocation()) {

      const icon = leaflet.AwesomeMarkers.icon({
        prefix: "fa",
        markerColor: "red",
        iconColor: "white",
        icon: "certificate",
        className: "awesome-marker sea-non-geo-marker",
        cluster: false
      });

      this.marker = leaflet.marker(this.defaultLatLng, {
        icon: icon,
        initiative: this.initiative
      });

      initiative.__internal.marker = this.marker;

      this.marker.bindPopup(opts.popuptext, {
        autoPan: false,
        minWidth: "472",
        maxWidth: "472",
        closeButton: false,
        className: "sea-initiative-popup sea-non-geo-initiative"
      });

      this.cluster = this.factory.hiddenClusterGroup;
      //this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = false;
    } else {
      const hovertext = this.presenter.getHoverText(initiative);

      const icon = leaflet.AwesomeMarkers.icon({
        prefix: "fa",
        markerColor: this.initiative.primaryActivity
                   ? this.initiative.primaryActivity.toLowerCase().replace(/\W/g, '_')
                   : "ALL",
        iconColor: "white",
        icon: "certificate",
        className: "awesome-marker sea-marker",
        cluster: false,
      });

      //this.marker = leaflet.marker(this.presenter.getLatLng(initiative), {icon: icon, title: hovertext});
      this.marker = leaflet.marker(this.presenter.getLatLng(initiative), {
        icon: icon,
        initiative: this.initiative
      });

      initiative.__internal.marker = this.marker;

      // maxWidth helps to accomodate big font, for presentation purpose, set up in CSS
      // maxWidth:800 is needed if the font-size is set to 200% in CSS:
      this.marker.bindPopup(opts.popuptext, {
        autoPan: false,
        //minWidth: "472",
        //maxWidth: "800",
        closeButton: false,
        className: "sea-initiative-popup"
      });
      this.marker.bindTooltip(this.presenter.getHoverText(initiative));
      const that = this;
      this.marker.on("click", function (e) {
        that.onClick(e);
      });
      this.cluster = this.factory.unselectedClusterGroup;
      this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = true;
    }
  }

  onClick(e) {
    // console.log("MarkerView.onclick");
    // Browser seems to consume the ctrl key: ctrl-click is like right-buttom-click (on Chrome)
    if (e.originalEvent.ctrlKey) {
      console.log("ctrl");
    }
    if (e.originalEvent.altKey) {
      console.log("alt");
    }
    if (e.originalEvent.metaKey) {
      console.log("meta");
    }
    if (e.originalEvent.shiftKey) {
      console.log("shift");
    }
    if (e.originalEvent.shiftKey) {
      this.presenter.notifySelectionToggled(this.initiative);
    } else {
      console.log(this.initiative);
      // this.presenter.notifySelectionSet(this.initiative);
      eventbus.publish({
        topic: "Directory.InitiativeClicked",
        data: this.initiative
      });
    }
  }

  setUnselected(initiative) {
    //close pop-up
    this.mapObj.closePopup();
    //close information on the left hand side (for smaller screens)
    eventbus.publish({
      topic: "Sidebar.hideInitiative"
    });
    //reset the map vars and stop the zoom event from triggering selectInitiative ({target}) method
    this.mapObj.selectedInitiative = undefined;

    //change the color of an initiative with a location
    if (initiative.hasLocation()) {
      this.marker.setIcon(
        leaflet.AwesomeMarkers.icon({
          prefix: "fa",
          markerColor: this.initiative.primaryActivity
                     ? this.initiative.primaryActivity.toLowerCase()
                     : "AM00",
          iconColor: "white",
          icon: "certificate",
          className: "awesome-marker sea-marker",
          cluster: false
        })
      );
    }
  }

  setSelected(initiative) {
    let that = this;
    //set initiative for selection
    this.mapObj.selectedInitiative = initiative;
    //change the color of the marker to a slightly darker shade
    if (initiative.hasLocation()) {
      initiative.__internal.marker.setIcon(
        leaflet.AwesomeMarkers.icon({
          prefix: "fa",
          markerColor: initiative.primaryActivity
                     ? initiative.primaryActivity.toLowerCase()
                     : "ALL",
          iconColor: "white",
          icon: "certificate",
          className: "awesome-marker sea-marker sea-selected",
          cluster: false
        })
      );
    }

    if (!initiative.hasLocation()) {
      initiative.__internal.marker.openPopup();
    }
    // If the marker is in a clustergroup that's currently animating then wait until the animation has ended
    else if (this.factory.unselectedClusterGroup._inZoomAnimation) {
      this.factory.unselectedClusterGroup.on("animationend", e => {
        //if the initiative is not visible (it's parent is a cluster instaed of the initiative itself )
        if (
          this.factory.unselectedClusterGroup.getVisibleParent(initiative.__internal.marker) !==
            initiative.__internal.marker
        ) {
          if (initiative.__internal.marker.__parent) //if it has a parent
          {
            initiative.__internal.marker.__parent.spiderfy();
          }
        }
        initiative.__internal.marker.openPopup();
        this.factory.unselectedClusterGroup.off("animationend");
      });
    }
    // Otherwise the marker is in a clustergroup so it'll need to be spiderfied
    else {
      if (
        this.factory.unselectedClusterGroup.getVisibleParent(initiative.__internal.marker) !==
          initiative.__internal.marker
      ) {

        initiative.__internal.marker.__parent.spiderfy();
      }
      initiative.__internal.marker.openPopup();
    }

    //deselect initiative when it becomes clustered. i.e. when it has a parent other than itself 
    let deselectInitiative = function () {
      if (this.factory.unselectedClusterGroup.getVisibleParent(initiative.__internal.marker) !==
        initiative.__internal.marker) {
        that.setUnselected(initiative);
        eventbus.publish({
          topic: "Directory.InitiativeClicked"
        });
        this.factory.unselectedClusterGroup.off("animationend", deselectInitiative);
      }
    }
    //check for clustering at each animation of the layer
   this.factory.unselectedClusterGroup.on("animationend", deselectInitiative);

  }

  showTooltip(initiative) {
    // This variation zooms the map, and makes sure the marker can
    // be seen, spiderifying if needed.
    // But this auto-zooming maybe more than the user bargained for!
    // It might disrupt their flow.
    //this.cluster.zoomToShowLayer(this.marker);

    // This variation spiderfys the cluster to which the marker belongs.
    // This only works if selectedClusterGroup is actually a ClusterGroup!
    // const cluster = this.factory.unselectedClusterGroup.getVisibleParent(this.marker);
    // if (cluster && typeof cluster.spiderfy === 'function') {
    //   cluster.spiderfy();
    // }
    this.marker.openTooltip();
    this.marker.setZIndexOffset(1000);
  }

  hideTooltip(initiative) {
    this.marker.closeTooltip();
    this.marker.setZIndexOffset(0);
  }
  
  getInitiativeContent(initiative) {
    return this.presenter.getInitiativeContent(initiative);
  }

  destroy() {
    //this.marker.hasPhysicalLocation = false;
    this.cluster.removeLayer(this.marker);
  }

  show() {
    this.cluster.addLayer(this.marker);
  }
  
  isVisible() {
    return this.cluster.hasLayer(this.marker);
  }
}

export class MarkerViewFactory {

  // Keep a mapping between initiatives and their Markers:
  // Note: contents currently contain only the active dataset
  markerForInitiative = {};

  
  // CAUTION: this may be either a ClusterGroup, or the map itself
  hiddenClusterGroup = null;
  unselectedClusterGroup = null;


  constructor(defaultLatLng, popup, dataServices) {
    this.defaultLatLng = defaultLatLng;
    this.popup = popup;
    this.dataServices = dataServices;
  }

  setSelected(initiative) {
    if (this.markerForInitiative[initiative.uri])
      this.markerForInitiative[initiative.uri].setSelected(initiative);
  }
  setUnselected(initiative) {
    if (this.markerForInitiative[initiative.uri])
      this.markerForInitiative[initiative.uri].setUnselected(initiative);
  }

  destroyAll() {
    let that = this;
    let initiatives = Object.keys(this.markerForInitiative);
    initiatives.forEach(initiative => {
      if (this.markerForInitiative[initiative])
        this.markerForInitiative[initiative].destroy();
    });
    this.markerForInitiative = {};
  }

  showMarkers(initiatives) {
    //show markers only if it is not currently vissible
    initiatives.forEach(initiative => {
      const marker = this.markerForInitiative[initiative.uri];
      if (marker && !marker.isVisible())
        marker.show();
    });

  }

  hideMarkers(initiatives) {
    initiatives.forEach(initiative => {
      if (this.markerForInitiative[initiative.uri])
        this.markerForInitiative[initiative.uri].destroy();
    });
  }

  createMarker(map, initiative) {
    const presenter = new MapMarkerPresenter(dataServices, this.popup);
    const view = new MapMarkerView(presenter, map, initiative, this.defaultLatLng, this);
    presenter.registerView(view);
    this.markerForInitiative[initiative.uri] = view;
    return view;
  }

  refreshMarker(initiative) {
    if (!this.markerForInitiative[initiative.uri])
      return;
    this.markerForInitiative[initiative.uri]
      .marker
      .setPopupContent(this.markerForInitiative[initiative.uri].presenter.getInitiativeContent(initiative));
  }

  setSelectedClusterGroup(clusterGroup) {
    // CAUTION: this may be either a ClusterGroup, or the map itself
    this.hiddenClusterGroup = clusterGroup;
  }

  setUnselectedClusterGroup(clusterGroup) {
    this.unselectedClusterGroup = clusterGroup;
  }

  showTooltip(initiative) {
    if (this.markerForInitiative[initiative.uri])
      this.markerForInitiative[initiative.uri].showTooltip(initiative);
  }
  
  hideTooltip(initiative) {
    if (this.markerForInitiative[initiative.uri])
      this.markerForInitiative[initiative.uri].hideTooltip(initiative);
  }

  getInitiativeContent(initiative) {
    // console.log(this.getInitiativeContent(initiative));
    if (this.markerForInitiative[initiative.uri])
      return this.markerForInitiative[initiative.uri].getInitiativeContent(
        initiative
      );
    else return null;
  }

  getClusterGroup() {
    return this.unselectedClusterGroup;
  }
  
}
