"use strict";
const eventbus = require('../../eventbus');
const { BaseSidebarPresenter } = require('./base');

export class DatasetsPresenter extends BaseSidebarPresenter {
  mixedId = "all";

  
  constructor(view, dataServices) {
    super();
    this.registerView(view);
    this.dataServices = dataServices;
  }
  
  getDatasets() {
    return this.dataServices.getDatasets();
  }
  
  getDefault() {
    let val = this.dataServices.getCurrentDatasets();
    return val === true? "all" : val;
  }
  
  getMixedId() {
    return this.mixedId;
  }

  // Called when the user selects a dataset in the datasets sidebar panel
  //
  // @param dataset - the name of the selected dataset, or boolean `true` to select all datasets
  //
  //set default somewhere else where it loads the initiatives
  //remove initiatives from menu on the side
  //remove initiatives from map
  changeDatasets(dataset) {
    this.dataServices.reset(dataset); // simply delegate
  };
}
