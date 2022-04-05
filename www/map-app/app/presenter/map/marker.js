"use strict";
const eventbus = require('../../eventbus');

function init(registry) {
  const config = registry('config');
  const presenter = registry('presenter');
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
