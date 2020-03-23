define([
  "app/eventbus",
  "model/config",
  "model/sse_initiative",
  "presenter"
], function(eventbus, config, sseInitiative, presenter) {
  "use strict";

  function Presenter() {}

  var proto = Object.create(presenter.base.prototype);
  proto.performSearch = function(text) {
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
      var results = sseInitiative.search(text);
      console.log(results);
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
  };


  proto.changeSearchText = function(txt){
    this.view.changeSearchText(txt);
  };

  Presenter.prototype = proto;

  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);

    eventbus.subscribe({
      topic: "Search.changeSearchText",
      callback: function(data){
        p.changeSearchText(data.txt)
      }
    });
    return p;
  }
  var pub = {
    createPresenter: createPresenter
  };
  return pub;
});
