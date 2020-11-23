/*define([
    "app/eventbus",
    "model/config",
    "model/sse_initiative",
    "view/sidebar/base",
    "presenter/sidebar/base",
    "view/map/marker"
  ], function(
    eventbus,
    config,
    sseInitiative,
    sidebarView,
    sidebarPresenter,
    markerView
  ) {*/
  const eventbus = require('../../eventbus');
  const sidebarView = require('../../view/sidebar/base');

    "use strict";

function init(config) {
  const sseInitiative = require('../../model/sse_initiative')(config);
  const sidebarPresenter = require('../../presenter/sidebar/base')(config);
  const markerView = require('../../view/map/marker')(config);
  
  function Presenter() {}
  
  var proto = Object.create(sidebarPresenter.base.prototype);
  
    Presenter.prototype = proto;

    let mixedId = "all";
    //test
    proto.getDatasets = () => {
      return sseInitiative.getAllDatasets();
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
//  });
  
