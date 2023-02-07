"use strict";
import * as eventbus from '../../eventbus';
import { BasePresenter } from '../../presenter';
import { BaseSidebarPresenter } from '../sidebar/base';

export class MapMarkerPresenter extends BasePresenter {
  
  constructor(dataServices, popup) {
    super();
    this.dataservices = dataServices;
    this.labels = dataServices.getFunctionalLabels();
    this.popup = popup;
  }

  notifySelectionToggled(initiative) {
    eventbus.publish({ topic: "Marker.SelectionToggled", data: initiative });
  }

  notifySelectionSet(initiative) {
    eventbus.publish({ topic: "Marker.SelectionSet", data: initiative });
  }

  getLatLng(initiative) {
    return [initiative.lat, initiative.lng];
  }

  getHoverText(initiative) {
    return initiative.name;
  }

  prettyPhone(tel) {
    return tel.replace(/^(\d)(\d{4})\s*(\d{6})/, "$1$2 $3");
  }
  
  getInitiativeContent(initiative) {
    return this.popup(initiative, this.dataservices, this.labels);
  }

  getMarkerColor(initiative) {
    const hasWww = initiative.www && initiative.www.length > 0;
    const hasReg = initiative.regorg && initiative.regorg.length > 0;
    const markerColor =
      hasWww && hasReg ? "purple" : hasWww ? "blue" : hasReg ? "red" : "green";
    return markerColor;
  }

  getIconOptions(initiative) {
    const icon = initiative.dataset == "dotcoop" ? "globe" : "certificate";
    return {
      icon: icon,
      popuptext: popuptext,
      hovertext: hovertext,
      cluster: true,
      markerColor: markerColor
    }
  }
  
  getIcon(initiative) {
    return initiative.dataset == "dotcoop" ? "globe" : "certificate";
  }
}
