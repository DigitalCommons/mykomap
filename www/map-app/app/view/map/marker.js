define([
  "leaflet",
  "leafletMarkerCluster",
  "leafletAwesomeMarkers",
  "view/base",
  "presenter/map/marker",
  "app/eventbus",
  "model/sse_initiative"
], function (leaflet, cluster, awesomeMarkers, viewBase, presenter, eventbus, sse_initiatives) {
  "use strict";

  // Keep a mapping between initiatives and their Markers:
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
    mapObj.closePopup();
    eventbus.publish({
      topic: "Sidebar.hideInitiative"
    });
    try {
      initiative.marker.__parent.unspiderfy();
    } catch (e) { }
    mapObj.selectedInitiative = undefined;
    mapObj.off("zoomend", selectInitiative);
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
    mapObj.selectedInitiative = initiative;
    mapObj.on("zoomend", selectInitiative);
    unselectedClusterGroup.once("clusterclick", e => {
      this.setUnselected(initiative);
    });
  };

  function selectInitiative({ target }) {
    let initiative = target.selectedInitiative;
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
        if (
          unselectedClusterGroup.getVisibleParent(initiative.marker) !==
          initiative.marker
        ) {
          if (initiative.marker.__parent) //if it has a parent
            initiative.marker.__parent.spiderfy();
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
  }

  proto.showTooltip = function (initiative) {
    // This variation zooms the map, and makes sure the marker can
    // be seen, spiderifying if needed.
    // But this auto-zooming maybe more than the user bargained for!
    // It might disrupt their flow.
    //this.cluster.zoomToShowLayer(this.marker);

    // This variation spiderfys the cluster to which the marker belongs.
    // This only works if selectedClusterGroup is actually a ClusterGroup!
    //const cluster = selectedClusterGroup.getVisibleParent(this.marker);
    //if (cluster && typeof cluster.spiderfy === 'function') {
    //cluster.spiderfy();
    //}
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
  proto.isVisible = function() {
    this.cluster.hasLayer(this.marker);
  }

  function destroyAll() {
    let that = this;
    let initiatives = Object.keys(markerForInitiative);
    initiatives.forEach(initiative => {
      markerForInitiative[initiative].destroy();
    });
    markerForInitiative = {};
  }
  MarkerView.prototype = proto;



  function showMarkers (initiatives){
    //show markers only if it is not currently vissible
    initiatives.forEach(initiative =>{
      if(!markerForInitiative[initiative.uniqueId].isVisible())
        markerForInitiative[initiative.uniqueId].show();
    });

  }

  function hideMarkers (initiatives){
    initiatives.forEach(initiative =>{
      if(markerForInitiative[initiative.uniqueId].isVisible())
        markerForInitiative[initiative.uniqueId].destroy();
    });
  }






  //from here
  // let hiddenMarkers = [];
  // let highlighted = [];
  // let currentFilterArray = [];
  // let lastWasSearchHistory = null;
  
  //TODO: NEEDS REFACTORING DOCUMENTATION AND OPTIMISATION
  //filter filters the results you search
  //add each to filter and hide all that aren't in the filtered ones
  //collect filters and remove them 
  //TODO: optimise the way you add remove things from currentFilterArray
  //initatives from different filters can overlap (make sure you catch that)


  


  //Search Markers
  // let lastSearched = [];
  // //these ones already passed the filter
  // function highlightSearchedForMarkers(initiatives){
  //   if(lastSearched==initiatives)
  //     return;
    
  //   //reveal old initiatives and set new
  //   revealSearchedInitiatives(lastSearched);
  //   lastSearched = initiatives;


  //   //remove all other markers except the ones identified by the passed initiatives
  //   const initativeIDs = initiatives.map(initiative => initiative.uniqueId);    




  // }

  // function revealSearchedInitiatives(){

  // }

  

  
  //Search
  // function highlightMarkers(initiatives,searchHistory=null) {

  //   if (highlighted == initiatives)
  //     return;
  //   showMarkersold();

  //   lastWasSearchHistory = searchHistory;
  

  //   //check if same request is being made

  //   //need to recreate thehighlightMarkershighlightMarkersm afterwards
  //   const uniqueIds = initiatives.map(initiative => initiative.uniqueId);
  //   const filteredIds = getFiltered();
  //   //remove all non-highlighted from the filtered ones

  //   if (filteredIds.length > 0 && !searchHistory) {
  //     filteredIds.filter(init => !uniqueIds.includes(init))
  //       .forEach(init => {init
  //         hiddenMarkers.push(init);
  //         markerForInitiative[init].destroy();
  //       });
  //   }
  //   else {
  //     //remove markers
  //     Object.keys(markerForInitiative).filter(init => !uniqueIds.includes(init))
  //       .forEach(init => {
  //           hiddenMarkers.push(init);
  //           markerForInitiative[init].destroy();
  //       });

  //     //reveal filtered ones in uniqueIds
  //     // if(searchHistory){
  //     //   const outsideFilter = Object.keys(markerForInitiative).filter(i => !filteredIds.includes(i));

  //     //   console.log("gets to this case");
  //     //   //get intersection of uniqueids and filtered ones and reveal them
  //     //   uniqueIds.filter(i => outsideFilter.includes(i))
  //     //   .forEach(m => {
  //     //     markerForInitiative[m].show();
  //     //   });        
  //     // }
      
  //   }

  //   highlighted = initiatives;
  // }


  //if last highlight was from search history initiatives outside of filter might be shown
  //to solve that you need to hide the ones that are not in the filter and remove them from hidden array
  //and then reveal hidden ones
  //effectively revealing only the filtered ones after a search
  // function showMarkersold() {
  //   // const filteredIds = getFiltered();
  //   // //hide ones not in filter
  //   // if (filteredIds.length != 0 && lastWasSearchHistory) {
  //   //   const outsideFilter = hiddenMarkers.filter(i => !filteredIds.includes(i));

  //   //   outsideFilter.forEach(m => {
  //   //     markerForInitiative[m].destroy();
  //   //   });

  //   //   hiddenMarkers = hiddenMarkers.filter(i => !outsideFilter.includes(i));
  //   // }
    
  //   // hiddenMarkers.forEach(m => {
  //   //   markerForInitiative[m].show();
  //   // });


  //   //pan and zoom
  //   //pass filtered initiatives
  //   const latlng = sse_initiatives.latLngBounds(null)
  //   eventbus.publish({
  //     topic: "Map.needsToBeZoomedAndPanned",
  //     data: {
  //       bounds: latlng,
  //       options: {
  //         maxZoom: 3
  //       }
  //     }
  //   });
  //   hiddenMarkers = [];
  //   highlighted = [];

  // }



//to here



  function createMarker(map, initiative) {
    const view = new MarkerView();
    view.setPresenter(presenter.createPresenter(view));
    view.create(map, initiative);
    return view;
  }
  function setSelectedClusterGroup(clusterGroup) {
    // CAUTION: this may be either a ClusterGroup, or the map itself
    hiddenClusterGroup = clusterGroup;
  }
  function setUnselectedClusterGroup(clusterGroup) {
    unselectedClusterGroup = clusterGroup;
  }
  function showTooltip(initiative) {
    markerForInitiative[initiative.uniqueId].showTooltip(initiative);
  }
  function hideTooltip(initiative) {
    markerForInitiative[initiative.uniqueId].hideTooltip(initiative);
  }

  function getInitiativeContent(initiative) {
    // console.log(this.getInitiativeContent(initiative));
    return markerForInitiative[initiative.uniqueId].getInitiativeContent(
      initiative
    );
  }

  function getClusterGroup() {
    return this.unselectedClusterGroup;
  }

  var pub = {
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
  };
  return pub;
});
