"use strict";
const leaflet = require('leaflet');
const leafletMarkerCluster = require('leaflet.markercluster');
const leafletAwesomeMarkers = require('leaflet.awesome-markers');
const cssesc = require('cssesc');
const eventbus = require('../../eventbus');

const { base } = require('../base');

class MarkerFactory  {
  // Keep a mapping between initiatives and their Markers:
  // Note: contents currently contain only the active dataset
  markerForInitiative = {};
  // CAUTION: this may be either a ClusterGroup, or the map itself
  hiddenClusterGroup = null;
  unselectedClusterGroup = null;
  

  constructor(config, presenterFactory) {
    this.config = config;
    this.presenterFactory = presenterFactory;
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
    const view = new MarkerView(this, map, initiative);
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

class MarkerView extends base {
  // Using font-awesome icons, the available choices can be seen here:
  // http://fortawesome.github.io/Font-Awesome/icons/
  // "fa" selects the font-awesome icon set (we have no other)
  static dfltOptions = { prefix: "fa" };
  
  // Convert a field id / definition into an array of CSS classes
  static classesForField(fieldId, fieldDef, value) {
    if (!fieldDef.isStyled)
      return [];

    // Multi fields are special
    if (fieldDef.type === 'multi')
      return value.map(elem => this.classesForFields(fieldId, fieldDef.of, elem));

    // Other field types all equivalent
    const components = ['sea-marker', fieldId, String(value)];
    return [components.join('_').toLowerCase()];
  }

  // Converts the field definitions
  static classesForFields(initiative, fields) {
    // Iterate the fields, converting each of them into an array CSS classes
    return Object.entries(fields).flatMap(
      ([fieldId, fieldDef]) => this.classesForField(fieldId, fieldDef, initiative[fieldId])
    );
  }

  constructor(markerFactory, map, initiative) {
    super();
    this.markerFactory = markerFactory;
    this.initiative = initiative;
    this.mapObj = map;
    this.config = markerFactory.config;
    this.setPresenter(markerFactory.presenterFactory.createPresenter(this));
    
    // options argument overrides our default options:
    const opts = Object.assign(this.constructor.dfltOptions, {
      popuptext: this.presenter.getInitiativeContent(initiative)
    });

    // For non-geo initiatives we don't need a marker but still want to get the initiativeContent
    // TODO: Content generation should live somewhere else.
    // const ukPostcode = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;
    if (!initiative.hasLocation()) {
      const classes = ['awesome-marker', 'sea-non-geo-marker']
        .concat(this.constructor.classesForFields(initiative, this.config.fields()));
      
      const icon = leaflet.AwesomeMarkers.icon({
        prefix: 'fa',
        icon: 'certificate',
        className: classes.join(' '),
        cluster: false
      });

      this.marker = leaflet.marker(this.config.getDefaultLatLng(), {
        icon: icon,
        initiative: this.initiative
      });

      this.initiative.__internal.marker = this.marker;

      this.marker.bindPopup(opts.popuptext, {
        autoPan: false,
        minWidth: "472",
        maxWidth: "472",
        closeButton: false,
        className: "sea-initiative-popup sea-non-geo-initiative"
      });

      this.cluster = this.markerFactory.hiddenClusterGroup;
      //this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = false;
    }
    else {
      const hovertext = this.presenter.getHoverText(initiative);
      const classes = ['awesome-marker', 'sea-marker']
        .concat(this.constructor.classesForFields(initiative, this.config.fields()));
      
      
      const icon = leaflet.AwesomeMarkers.icon({
        prefix: 'fa',
        icon: 'certificate',
        className: classes.join(' '),
        cluster: false,
      });
      
      //this.marker = leaflet.marker(this.presenter.getLatLng(initiative), {icon: icon, title: hovertext});
      this.marker = leaflet.marker(this.presenter.getLatLng(initiative), {
        icon: icon,
        initiative: this.initiative
      });

      this.initiative.__internal.marker = this.marker;

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
      this.marker.on("click", (e) => {
        this.onClick(e);
      });
      this.cluster = this.markerFactory.unselectedClusterGroup;
      this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = true;
    }

    this.markerFactory.markerForInitiative[initiative.uri] = this;
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
  };



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
    if (this.initiative.hasLocation()) {
      const classes = ['awesome-marker', 'sea-marker']
        .concat(this.constructor.classesForFields(this.initiative, this.config.fields()));
      
      this.marker.setIcon(
        leaflet.AwesomeMarkers.icon({
          prefix: 'fa',
          icon: 'certificate',
          className: classes.join(' '),
          cluster: false
        })
      );
    }
  };

  setSelected(initiative) {
    //set initiative for selection
    this.mapObj.selectedInitiative = initiative;
    //change the color of the marker to a slightly darker shade
    if (this.initiative.hasLocation()) {
      const classes = ['awesome-marker', 'sea-marker', 'sea-selected']
        .concat(this.constructor.classesForFields(this.initiative, this.config.fields()));
      
      this.initiative.__internal.marker.setIcon(
        leaflet.AwesomeMarkers.icon({
          prefix: 'fa',
          icon: 'certificate',
          className: classes.join(' '),
          cluster: false
        })
      );
    }

    if (!this.initiative.hasLocation()) {
      this.initiative.__internal.marker.openPopup();
    }
    // If the marker is in a clustergroup that's currently animating then wait until the animation has ended
    else if (this.markerFactory.unselectedClusterGroup._inZoomAnimation) {
      this.markerFactory.unselectedClusterGroup.on("animationend", e => {
        //if the initiative is not visible (it's parent is a cluster instaed of the initiative itself )
        if (
          this.markerFactory.unselectedClusterGroup.getVisibleParent(this.initiative.__internal.marker) !==
            this.initiative.__internal.marker
        ) {
          if (this.initiative.__internal.marker.__parent) //if it has a parent
          {
            this.initiative.__internal.marker.__parent.spiderfy();
          }
        }
        this.initiative.__internal.marker.openPopup();
        this.markerFactory.unselectedClusterGroup.off("animationend");
      });
    }
    // Otherwise the marker is in a clustergroup so it'll need to be spiderfied
    else {
      if (
        this.markerFactory.unselectedClusterGroup.getVisibleParent(this.initiative.__internal.marker) !==
          this.initiative.__internal.marker
      ) {

        this.initiative.__internal.marker.__parent.spiderfy();
      }
      this.initiative.__internal.marker.openPopup();
    }

    //deselect initiative when it becomes clustered. i.e. when it has a parent other than itself 
    let deselectInitiative = () => {
      if (this.markerFactory.unselectedClusterGroup.getVisibleParent(this.initiative.__internal.marker) !==
        this.initiative.__internal.marker) {
        this.setUnselected(initiative);
        eventbus.publish({
          topic: "Directory.InitiativeClicked"
        });
        this.markerFactory.unselectedClusterGroup.off("animationend", deselectInitiative);
      }
    };
    //check for clustering at each animation of the layer
    this.markerFactory.unselectedClusterGroup.on("animationend", deselectInitiative);

  };
  showTooltip(initiative) {
    // This variation zooms the map, and makes sure the marker can
    // be seen, spiderifying if needed.
    // But this auto-zooming maybe more than the user bargained for!
    // It might disrupt their flow.
    //this.cluster.zoomToShowLayer(this.marker);

    // This variation spiderfys the cluster to which the marker belongs.
    // This only works if selectedClusterGroup is actually a ClusterGroup!
    // const cluster = unselectedClusterGroup.getVisibleParent(this.marker);
    // if (cluster && typeof cluster.spiderfy === 'function') {
    //   cluster.spiderfy();
    // }
    this.marker.openTooltip();
    this.marker.setZIndexOffset(1000);
  };
  hideTooltip(initiative) {
    this.marker.closeTooltip();
    this.marker.setZIndexOffset(0);
  };
  getInitiativeContent(initiative) {
    return this.presenter.getInitiativeContent(initiative);
  };
  destroy() {
    //this.marker.hasPhysicalLocation = false;
    this.cluster.removeLayer(this.marker);
  };

  show() {
    this.cluster.addLayer(this.marker);
  }
  isVisible() {
    return this.cluster.hasLayer(this.marker);
  }
}

function init(registry) {
  const config = registry('config');
  const presenterFactory = registry('presenter/map/marker');

  return new MarkerFactory(config, presenterFactory);
}

module.exports = init;
