/*define([
   "leaflet",
   "leafletMarkerCluster",
   "leafletAwesomeMarkers",
   "view/base",
   "presenter/map/marker",
   "app/eventbus",
   "model/sse_initiative"
   ], function (leaflet, cluster, awesomeMarkers, viewBase, presenter, eventbus, sse_initiatives) {*/

const leaflet = require('leaflet');
const leafletMarkerCluster = require('leaflet.markercluster');
const leafletAwesomeMarkers = require('leaflet.awesome-markers');
const eventbus = require('../../eventbus');


  "use strict";

function init(registry) {
  const config = registry('config');
  const viewBase = registry('view/base');
  const presenter = registry('presenter/map/marker');

  // Keep a mapping between initiatives and their Markers:
  // Note: contents currently contain only the active dataset
  let markerForInitiative = {};
  // CAUTION: this may be either a ClusterGroup, or the map itself
  let hiddenClusterGroup = null;
  let unselectedClusterGroup = null;

  function MarkerView() { }
  // inherit from the standard view base object:
  var proto = Object.create(viewBase.base.prototype);

  var mapObj;

  // Using font-awesome icons, the available choices can be seen here:
  // http://fortawesome.github.io/Font-Awesome/icons/
  const dfltOptions = { prefix: "fa" }; // "fa" selects the font-awesome icon set (we have no other)

  proto.create = function (map, initiative) {
    this.initiative = initiative;
    mapObj = map;

    // options argument overrides our default options:
    const opts = Object.assign(dfltOptions, {
      // icon: this.presenter.getIcon(initiative),
      popuptext: this.presenter.getInitiativeContent(initiative)
      // hovertext: this.presenter.getHoverText(initiative),
      // cluster: true,
      // markerColor: this.presenter.getMarkerColor(initiative)
    });

    // For non-geo initiatives we don't need a marker but still want to get the initiativeContent
    // TODO: Content generation should live somewhere else.
    // const ukPostcode = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;
    if (!initiative.lat || !initiative.lng) {
      initiative.nongeo = 1;

      initiative.lat = initiative.nongeoLat;
      initiative.lng = initiative.nongeoLng;

      const icon = leaflet.AwesomeMarkers.icon({
        prefix: "fa",
        markerColor: "red",
        iconColor: "white",
        icon: "certificate",
        className: "awesome-marker sea-non-geo-marker",
        cluster: false
      });

      this.marker = leaflet.marker(this.presenter.getLatLng(initiative), {
        icon: icon,
        initiative: this.initiative
      });

      initiative.marker = this.marker;

      this.marker.bindPopup(opts.popuptext, {
        autoPan: false,
        minWidth: "472",
        maxWidth: "472",
        closeButton: false,
        className: "sea-initiative-popup sea-non-geo-initiative"
      });

      this.cluster = hiddenClusterGroup;
      //this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = false;
    } else {
      const hovertext = this.presenter.getHoverText(initiative);

      const icon = leaflet.AwesomeMarkers.icon({
        prefix: "fa",
        markerColor: this.initiative.primaryActivity
          ? this.initiative.primaryActivity.toLowerCase()
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

      initiative.marker = this.marker;

      // maxWidth helps to accomodate big font, for presentation purpose, set up in CSS
      // maxWidth:800 is needed if the font-size is set to 200% in CSS:
      this.marker.bindPopup(opts.popuptext, {
        autoPan: false,
        minWidth: "472",
        maxWidth: "472",
        closeButton: false,
        className: "sea-initiative-popup"
      });
      this.marker.bindTooltip(this.presenter.getHoverText(initiative));
      const that = this;
      this.marker.on("click", function (e) {
        that.onClick(e);
      });
      this.cluster = unselectedClusterGroup;
      this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = true;
    }

    markerForInitiative[initiative.uniqueId] = this;
  };
  proto.onClick = function (e) {
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



  proto.setUnselected = function (initiative) {
    //close pop-up
    mapObj.closePopup();
    //close information on the left hand side (for smaller screens)
    eventbus.publish({
      topic: "Sidebar.hideInitiative"
    });
    //reset the map vars and stop the zoom event from triggering selectInitiative ({target}) method
    mapObj.selectedInitiative = undefined;

    //change the color of an initiative with a location
    if (!initiative.nongeo) {
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
  };

  proto.setSelected = function (initiative) {
    let that = this;
    //set initiative for selection
    mapObj.selectedInitiative = initiative;
    //change the color of the marker to a slightly darker shade
    if (!initiative.nongeo) {
      initiative.marker.setIcon(
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

    if (initiative.nongeo) {
      initiative.marker.openPopup();
    }
    // If the marker is in a clustergroup that's currently animating then wait until the animation has ended
    else if (unselectedClusterGroup._inZoomAnimation) {
      unselectedClusterGroup.on("animationend", e => {
        //if the initiative is not visible (it's parent is a cluster instaed of the initiative itself )
        if (
          unselectedClusterGroup.getVisibleParent(initiative.marker) !==
          initiative.marker
        ) {
          if (initiative.marker.__parent) //if it has a parent
          {
            initiative.marker.__parent.spiderfy();
          }
        }
        initiative.marker.openPopup();
        unselectedClusterGroup.off("animationend");
      });
    }
    // Otherwise the marker is in a clustergroup so it'll need to be spiderfied
    else {
      if (
        unselectedClusterGroup.getVisibleParent(initiative.marker) !==
        initiative.marker
      ) {

        initiative.marker.__parent.spiderfy();
      }
      initiative.marker.openPopup();
    }

    //deselect initiative when it becomes clustered. i.e. when it has a parent other than itself 
    let deselectInitiative = function () {
      if (unselectedClusterGroup.getVisibleParent(initiative.marker) !==
        initiative.marker) {
        that.setUnselected(initiative.marker);
        eventbus.publish({
          topic: "Directory.InitiativeClicked"
        });
        unselectedClusterGroup.off("animationend", deselectInitiative);
      }
    };
    //check for clustering at each animation of the layer
    unselectedClusterGroup.on("animationend", deselectInitiative);

  };


  //old code for not destroying pop-up when zooming out
  // proto.setSelected = function (initiative) {
  //   //set initiative for selection
  //   mapObj.selectedInitiative = initiative;
  //   //zoom counter
  //   mapObj.counttest = 1;
  //   //displays marker on all zoom events by triggering selectInitiative function
  //   mapObj.on("zoomend", selectInitiative);  
  //   /* tip: this can be used to uncluster a specific marker
  //   unselectedClusterGroup.removeLayer(initiative.marker);
  //   hiddenClusterGroup.addLayer(initiative.marker);
  //    */
  //   //next time you click on a cluster, will unselect the current selection

  // };

  // function selectInitiative({ target }) {
  //   //get the initiative selected (specified in setSelected)
  //   let initiative = target.selectedInitiative;

  //   //change the color of the marker to a slightly darker shade
  //   if (!initiative.nongeo) {
  //     initiative.marker.setIcon(
  //       leaflet.AwesomeMarkers.icon({
  //         prefix: "fa",
  //         markerColor: initiative.primaryActivity
  //           ? initiative.primaryActivity.toLowerCase()
  //           : "ALL",
  //         iconColor: "white",
  //         icon: "certificate",
  //         className: "awesome-marker sea-marker sea-selected",
  //         cluster: false
  //       })
  //     );
  //   }

  //   if (initiative.nongeo) {
  //     initiative.marker.openPopup();
  //   }

  //   // If the marker is in a clustergroup that's currently animating then wait until the animation has ended
  //   else if (unselectedClusterGroup._inZoomAnimation) {
  //     unselectedClusterGroup.on("animationend", e => {
  //       //if the initiative is not visible (it's parent is a cluster instaed of the initiative itself )
  //       if (
  //         unselectedClusterGroup.getVisibleParent(initiative.marker) !==
  //         initiative.marker
  //       ) {
  //         if (initiative.marker.__parent) //if it has a parent
  //         {
  //           initiative.marker.__parent.spiderfy();
  //         }
  //       }
  //       initiative.marker.openPopup();
  //       unselectedClusterGroup.off("animationend");
  //     });
  //   }
  //   // Otherwise the marker is in a clustergroup so it'll need to be spiderfied
  //   else {
  //     if (
  //       unselectedClusterGroup.getVisibleParent(initiative.marker) !==
  //       initiative.marker
  //     ) {

  //         console.log("error noanim");
  //         initiative.marker.__parent.spiderfy();
  //     }
  //     initiative.marker.openPopup();
  //   }

  //   //touch the parent so it triggers the unspiderify naturally
  //   mapObj.off("zoomend", selectInitiative); 
  //   initiative.marker.__parent.fire("touch");
  //   mapObj.counttest = mapObj.counttest-1;
  //   console.log(mapObj.counttest);
  //   if(mapObj.counttest<0){
  //     mapObj.off("zoomend", selectInitiative); 
  //     initiative.marker.__parent.fire("touch");

  //   }

  // }




  proto.showTooltip = function (initiative) {
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
  proto.hideTooltip = function (initiative) {
    this.marker.closeTooltip();
    this.marker.setZIndexOffset(0);
  };
  proto.getInitiativeContent = function (initiative) {
    return this.presenter.getInitiativeContent(initiative);
  };

  function setSelected(initiative) {
    if (markerForInitiative[initiative.uniqueId])
      markerForInitiative[initiative.uniqueId].setSelected(initiative);
  }
  function setUnselected(initiative) {
    if (markerForInitiative[initiative.uniqueId])
      markerForInitiative[initiative.uniqueId].setUnselected(initiative);
  }


  proto.destroy = function () {
    //this.marker.hasPhysicalLocation = false;
    this.cluster.removeLayer(this.marker);
  };

  proto.show = function () {
    this.cluster.addLayer(this.marker);
  }
  proto.isVisible = function () {
    return this.cluster.hasLayer(this.marker);
  }

  function destroyAll() {
    let that = this;
    let initiatives = Object.keys(markerForInitiative);
    initiatives.forEach(initiative => {
      if (markerForInitiative[initiative])
        markerForInitiative[initiative].destroy();
    });
    markerForInitiative = {};
  }
  MarkerView.prototype = proto;



  function showMarkers(initiatives) {
    //show markers only if it is not currently vissible
    initiatives.forEach(initiative => {
      const marker = markerForInitiative[initiative.uniqueId];
      if (marker && !marker.isVisible())
        marker.show();
    });

  }

  function hideMarkers(initiatives) {
    initiatives.forEach(initiative => {
      if (markerForInitiative[initiative.uniqueId])
        markerForInitiative[initiative.uniqueId].destroy();
    });
  }

  function createMarker(map, initiative) {
    const view = new MarkerView();
    view.setPresenter(presenter.createPresenter(view));
    view.create(map, initiative);
    return view;
  }

  function refreshMarker(initiative) {
    if (!markerForInitiative[initiative.uniqueId])
      return;
    markerForInitiative[initiative.uniqueId]
      .marker
      .setPopupContent(markerForInitiative[initiative.uniqueId].presenter.getInitiativeContent(initiative));
  }

  function setSelectedClusterGroup(clusterGroup) {
    // CAUTION: this may be either a ClusterGroup, or the map itself
    hiddenClusterGroup = clusterGroup;
  }
  function setUnselectedClusterGroup(clusterGroup) {
    unselectedClusterGroup = clusterGroup;
  }
  function showTooltip(initiative) {
    if (markerForInitiative[initiative.uniqueId])
      markerForInitiative[initiative.uniqueId].showTooltip(initiative);
  }
  function hideTooltip(initiative) {
    if (markerForInitiative[initiative.uniqueId])
      markerForInitiative[initiative.uniqueId].hideTooltip(initiative);
  }

  function getInitiativeContent(initiative) {
    // console.log(this.getInitiativeContent(initiative));
    if (markerForInitiative[initiative.uniqueId])
      return markerForInitiative[initiative.uniqueId].getInitiativeContent(
        initiative
      );
    else return null;
  }

  function getClusterGroup() {
    return this.unselectedClusterGroup;
  }


  return {
    createMarker: createMarker,
    setSelectedClusterGroup: setSelectedClusterGroup,
    setUnselectedClusterGroup: setUnselectedClusterGroup,
    setSelected: setSelected,
    setUnselected: setUnselected,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    getInitiativeContent: getInitiativeContent,
    getClusterGroup: getClusterGroup,
    destroyAll: destroyAll,
    hideMarkers: hideMarkers,
    showMarkers: showMarkers,
    refreshMarker: refreshMarker
  };
}

module.exports = init;
//});
