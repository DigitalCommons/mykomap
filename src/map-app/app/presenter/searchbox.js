"use strict";
import * as eventbus from '../eventbus';
import { base as BasePresenter } from '../presenter';

class SearchboxPresenter extends BasePresenter {

  constructor(view, getAggregatedData) {
    super();
    this.registerView(view);
    this.getAggregatedData = getAggregatedData;
  }
  
  performSearch(text) {
    console.log("Search submitted: [" + text + "]");
    // We need to make sure that the search sidebar is loaded
    if (text.length > 0) {
      eventbus.publish({
        topic: "Sidebar.hideInitiativeList"
      });
      eventbus.publish({
        topic: "Markers.needToShowLatestSelection",
        data: {
          selected: []
        }
      });
      var results = this.getAggregatedData().search(text);
      eventbus.publish({
        topic: "Search.initiativeResults",
        data: { text: text, results: results }
      });
    }
    else {
      //TODO: do other stuff like panning
      //causes err?
      eventbus.publish({topic: "Map.removeSearchFilter"});
      eventbus.publish({topic: "Sidebar.showDirectory"});
    }
  }


  changeSearchText(txt){
    this.view.changeSearchText(txt);
  }
}
