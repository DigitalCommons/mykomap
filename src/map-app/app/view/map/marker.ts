import * as leaflet from 'leaflet';
import { EventBus } from '../../../eventbus';
import { MapMarkerPresenter } from '../../presenter/map/marker';
import { BaseView } from '../base';
import { DataServices } from '../../model/dataservices';
import { InitiativeRenderFunction } from '../../model/config_schema';
import { ExtendedMarker, Map } from '../../map';
import { Point2d } from '../../../common_types';
import { Initiative } from '../../model/initiative';
import { toString as _toString } from '../../../utils';
import { MarkerViewFactory } from './markerviewfactory';

export class MapMarkerView extends BaseView {
  readonly presenter: MapMarkerPresenter;
  readonly marker: ExtendedMarker;
  
  // Using font-awesome icons, the available choices can be seen here:
  // http://fortawesome.github.io/Font-Awesome/icons/
  dfltOptions = { prefix: "fa" }; // "fa" selects the font-awesome icon set (we have no other)
  cluster: leaflet.MarkerClusterGroup = new leaflet.MarkerClusterGroup();

  
  constructor(readonly dataServices: DataServices,
              readonly popup: InitiativeRenderFunction,
              readonly mapObj: Map,
              readonly initiative: Initiative,
              readonly defaultLatLng: Point2d,
              readonly factory: MarkerViewFactory) {
    super();
    this.presenter = new MapMarkerPresenter(this, dataServices, popup);

    // options argument overrides our default options:
    const opts = Object.assign(this.dfltOptions, {
      // icon: this.presenter.getIcon(initiative),
      popuptext: this.presenter.getInitiativeContent(initiative)
    });

    // For non-geo initiatives we don't need a marker but still want to get the initiativeContent
    // TODO: Content generation should live somewhere else.
    // const ukPostcode = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;
    const latLng = this.presenter.getLatLng(initiative);
    if (!latLng) {

      const icon = leaflet.AwesomeMarkers.icon({
        prefix: "fa",
        markerColor: "red",
        iconColor: "white",
        icon: "certificate",
        className: "awesome-marker sea-non-geo-marker",
//         cluster: false // FIXME commented as fails typechecking, and I can't find any evidence that this does something useful
      });

      this.marker = leaflet.marker(this.defaultLatLng, {
        icon: icon,
//        initiative: this.initiative // FIXME this *seems* to be unused, and creates type checking errors
      }) as ExtendedMarker;

      initiative.__internal.marker = this.marker;

      this.marker.bindPopup(opts.popuptext, {
        autoPan: false,
        minWidth: 472,
        maxWidth: 472,
        closeButton: false,
        className: "sea-initiative-popup sea-non-geo-initiative"
      });

      this.cluster = this.factory.hiddenClusterGroup;
      //this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = false;
    }
    else {
      // FIXME this should not be hardwiring primaryActivity!
      // FIXME casting to 'any' for now as the types defined for markerColor do not include the values provided!
      const primaryActivity: any = _toString(this.initiative.primaryActivity, null);
      const icon = leaflet.AwesomeMarkers.icon({
        prefix: "fa",
        markerColor: primaryActivity !== null
                   ? primaryActivity.toLowerCase().replace(/\W/g, '_')
                   : "ALL",
        iconColor: "white",
        icon: "certificate",
        className: "awesome-marker sea-marker",
//        cluster: false, // FIXME commented as fails typechecking, and I can't find any evidence that this does something useful
      });

      this.marker = leaflet.marker(latLng, {
        icon: icon,
//        initiative: this.initiative // FIXME this *seems* to be unused, and creates type checking errors
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
      this.marker.on("click", (e) => {
        this.onClick(e);
      });
      this.cluster = this.factory.unselectedClusterGroup;
      this.cluster.addLayer(this.marker);
      this.marker.hasPhysicalLocation = true;
    }
  }

  onClick(e: leaflet.LeafletMouseEvent) {
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
      EventBus.Directory.initiativeClicked.pub(this.initiative);
    }
  }

  setUnselected(initiative: Initiative) {
    //close pop-up
    this.mapObj.closePopup();
    //close information on the left hand side (for smaller screens)
    EventBus.Sidebar.hideInitiative.pub();
    //reset the map vars and stop the zoom event from triggering selectInitiative ({target}) method

    //change the color of an initiative with a location
    if (initiative.hasLocation()) {
      // FIXME this should not be hardwiring primaryActivity!
      // FIXME casting to 'any' for now as the types defined for markerColor do not include the values provided!
      const primaryActivity: any = _toString(this.initiative.primaryActivity, null);
      this.marker.setIcon(
        leaflet.AwesomeMarkers.icon({
          prefix: "fa",
          markerColor: primaryActivity !== null
                     ? primaryActivity.toLowerCase()
                     : "AM00", // FIXME this should not be hardwired!
          iconColor: "white",
          icon: "certificate",
          className: "awesome-marker sea-marker",
//          cluster: false // FIXME commented as fails typechecking, and I can't find any evidence that this does something useful
        })
      );
    }
  }

  setSelected(initiative: Initiative) {
    const marker = initiative.__internal.marker;
    if (!(marker instanceof leaflet.Marker)) {
      console.error("initiative has no marker reference", initiative);
      return;
    }
    
    //set initiative for selection
    //change the color of the marker to a slightly darker shade
    if (initiative.hasLocation()) {
      // FIXME this should not be hardwiring primaryActivity!
      // FIXME casting to 'any' for now as the types defined for markerColor do not include the values provided!
      const primaryActivity: any = _toString(this.initiative.primaryActivity, null);
      marker.setIcon(
        leaflet.AwesomeMarkers.icon({
          prefix: "fa",
          markerColor: primaryActivity !== null
            ? primaryActivity.toLowerCase()
            : "ALL",
          iconColor: "white",
            icon: "certificate",
          className: "awesome-marker sea-marker sea-selected",
          //          cluster: false // FIXME commented as fails typechecking, and I can't find any evidence that this does something useful
        })
      );
      
      marker.openPopup();
    }
    
    // If the marker is in a clustergroup that's currently animating then wait until the animation has ended
    // @ts-ignore the sneaky access of a private member
    else if (this.factory.unselectedClusterGroup._inZoomAnimation) {
      this.factory.unselectedClusterGroup.on("animationend", _ => {
        //if the initiative is not visible (it's parent is a cluster instaed of the initiative itself )
        if (this.factory.unselectedClusterGroup.getVisibleParent(marker) !== marker
        ) {
          if ('__parent' in marker && marker?.__parent instanceof leaflet.MarkerCluster) {
            marker.__parent.spiderfy();
          }
        }
        marker.openPopup();
        this.factory.unselectedClusterGroup.off("animationend");
      });
    }
    // Otherwise the marker is in a clustergroup so it'll need to be spiderfied
    else {
      if (this.factory.unselectedClusterGroup.getVisibleParent(marker) !== marker) {
        if ('__parent' in marker && marker?.__parent instanceof leaflet.MarkerCluster) {
          marker.__parent.spiderfy();
        }
      }
      marker.openPopup();
    }

    //deselect initiative when it becomes clustered. i.e. when it has a parent other than itself 
    let deselectInitiative = (e: leaflet.LeafletEvent) => {
      if (this.factory.unselectedClusterGroup.getVisibleParent(marker) !== marker) {
        this.setUnselected(initiative);
        EventBus.Directory.initiativeClicked.pub(undefined); // deselects
        this.factory.unselectedClusterGroup.off("animationend", deselectInitiative);
      }
    }
    //check for clustering at each animation of the layer
   this.factory.unselectedClusterGroup.on("animationend", deselectInitiative);

  }

  showTooltip(initiative: Initiative) {
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

  hideTooltip(initiative: Initiative) {
    this.marker.closeTooltip();
    this.marker.setZIndexOffset(0);
  }
  
  getInitiativeContent(initiative: Initiative) {
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

