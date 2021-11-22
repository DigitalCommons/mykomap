"use strict";
const eventbus = require('../../eventbus');

function init(registry) {
  const config = registry('config');
  const sidebarView = registry('view/sidebar/base');
  const sseInitiative = registry('model/sse_initiative');
  const sidebarPresenter = registry('presenter/sidebar/base');
  const markerView = registry('view/map/marker');
  
  function Presenter() {}
  
  var proto = Object.create(sidebarPresenter.base.prototype);
  
  Presenter.prototype = proto;

  let mixedId = "all";
  //test
  proto.getDatasets = () => {
    return sseInitiative.getDatasets();
  }
  
  proto.getDefault = () => {
    let val = sseInitiative.getCurrentDatasets();
    return val===true? "all" : val;
  }

  proto.getMixedId = () => {
    return mixedId;
  }

  // Called when the user selects a dataset in the datasets sidebar panel
  //
  // @param dataset - the name of the selected dataset, or boolean `true` to select all datasets
  //
  //set default somewhere else where it loads the initiatives
  //remove initiatives from menu on the side
  //remove initiatives from map
  proto.changeDatasets = (dataset) => {
    sseInitiative.reset(dataset); // simply delegate
  };
  
  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);  
    return p;
  }
  return {
    createPresenter: createPresenter
  };
}

module.exports = init;
