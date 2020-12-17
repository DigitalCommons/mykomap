define([
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
  ) {
    "use strict";
  
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

      // This function selects one, all, or none of the datasets.
      // If the dataset value matches the current value of sseInitiative.getCurrentDatasets(),
      // do nothing.
      // If the dataset is literally true, select all of them.
      // If the dataset is a name, matching a dataset name, select just that dataset.
      // Otherwise, select none of them.
      //
    //set default somewhere else where it loads the initiatives
    //remove initiatives from menu on the side
    //remove initiatives from map
      proto.changeDatasets = (dataset) => {
          console.log("changeDatasets", dataset, sseInitiative.getCurrentDatasets());

          // Has the requested dataset(s) been selected already?
          if (sseInitiative.getCurrentDatasets() === dataset)
              return; // Yes, nothing to do

          sseInitiative.reset(true);
      };
  
    function createPresenter(view) {
      var p = new Presenter();
      p.registerView(view);  
      return p;
    }
    var pub = {
      createPresenter: createPresenter
        };
    return pub;
  });
  
