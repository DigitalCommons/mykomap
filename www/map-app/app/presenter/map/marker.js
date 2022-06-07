"use strict";
const eventbus = require('../../eventbus');
const presenter = require('../../presenter');

function init(registry) {
  const config = registry('config');
  const defaultPopup = registry('view/map/popup').getPopup;
  const sse_initiatives = registry('model/sse_initiative');

  const labels = sse_initiatives.getFunctionalLabels();
  
  function Presenter() { }

  const proto = Object.create(presenter.base.prototype);
  const serviceToDisplaySimilarCompanies =
    document.location.origin +
    document.location.pathname +
    config.getServicesPath() +
    "display_similar_companies/main.php";

  proto.notifySelectionToggled = function (initiative) {
    eventbus.publish({ topic: "Marker.SelectionToggled", data: initiative });
  };
  proto.notifySelectionSet = function (initiative) {
    eventbus.publish({ topic: "Marker.SelectionSet", data: initiative });
  };

  proto.getLatLng = function (initiative) {
    return [initiative.lat, initiative.lng];
  };
  proto.getHoverText = function (initiative) {
    return initiative.name;
  };
  proto.prettyPhone = function (tel) {
    return tel.replace(/^(\d)(\d{4})\s*(\d{6})/, "$1$2 $3");
  };
  // proto.getAllOrgStructures = function() {
  //   return sse_initiatives.getVerboseValuesForFields()["Organisational Structure"];
  // };
  proto.getInitiativeContent = function (initiative) {
    const customPopup = config.getCustomPopup();
    if (customPopup)
      return customPopup(initiative, sse_initiatives,labels);
    else
      // use this if there is no customPopup configured
      return defaultPopup(initiative, sse_initiatives,labels);
  };


  proto.getMarkerColor = function (initiative) {
    const hasWww = initiative.www && initiative.www.length > 0;
    const hasReg = initiative.regorg && initiative.regorg.length > 0;
    const markerColor =
      hasWww && hasReg ? "purple" : hasWww ? "blue" : hasReg ? "red" : "green";
    return markerColor;
  };
  proto.getIconOptions = function (initiative) {
    const icon = initiative.dataset == "dotcoop" ? "globe" : "certificate";
    return {
      icon: icon,
      popuptext: popuptext,
      hovertext: hovertext,
      cluster: true,
      markerColor: markerColor
    };
  };
  proto.getIcon = function (initiative) {
    return initiative.dataset == "dotcoop" ? "globe" : "certificate";
  };

  Presenter.prototype = proto;

  function createPresenter(view) {

    const p = new Presenter();
    p.registerView(view);
    return p;
  }

  return  {
    createPresenter: createPresenter
  };
}


module.exports = init;
