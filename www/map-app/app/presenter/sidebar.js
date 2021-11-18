"use strict";
const eventbus = require('../eventbus');

function init(registry) {
  const config = registry('config');
  const presenter = registry('presenter');
  
  // This is the presenter for the view/sidebar object.
  // Don't confuse this with the base object for all sidebar objects, which is in presenter/sidebar/base.
  const sidebarPresenter = registry('presenter/sidebar/base');

  function Presenter() {}

  var proto = Object.create(presenter.base.prototype);
  proto.changeSidebar = function(name) {
    this.view.changeSidebar(name);
  };

  proto.showSidebar = function() {
    this.view.showSidebar();
  };

  proto.showingDirectory = () => config.getShowDirectoryPanel();
  proto.showingSearch = () => config.getShowSearchPanel();
  proto.showingAbout = () => config.getShowAboutPanel();
  proto.showingDatasets = () => config.getShowDatasetsPanel();

  proto.hideSidebar = function(name) {
    this.view.hideSidebar();
  };

  proto.hideInitiativeSidebar = function(name) {
    this.view.hideInitiativeSidebar();
  };

  proto.hideInitiativeList = function(name) {
    this.view.hideInitiativeList();
  };

  Presenter.prototype = proto;

  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);

    eventbus.subscribe({
      topic: "Sidebar.showInitiatives",
      callback: function() {
        p.changeSidebar("initiatives");
        p.showSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.showAbout",
      callback: function() {
        p.changeSidebar("about");
        p.showSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.showDirectory",
      callback: function() {
        p.changeSidebar("directory");
        view.showInitiativeList();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.showDatasets",
      callback: function() {
        p.changeSidebar("datasets");
        p.showSidebar();
      }
    });


    eventbus.subscribe({
      topic: "Sidebar.showSidebar",
      callback: function() {
        p.showSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.hideSidebar",
      callback: function() {
        p.hideSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.hideInitiativeSidebar",
      callback: function() {
        p.hideInitiativeSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.hideInitiativeList",
      callback: function() {
        p.hideInitiativeList();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.updateSidebarWidth",
      callback: function(data) {
        sidebarPresenter.updateSidebarWidth(data);
      }
    });

    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: function(data) {
        p.changeSidebar();
      }
    });
    
    eventbus.subscribe({
      topic: "Initiative.complete",
      callback: function(data) {
        p.changeSidebar();
      }
    });

    // eventbus.subscribe({
    //   topic: "Initiative.selected",
    //   callback: function() {
    //     view.hideSidebarIfItTakesWholeScreen();
    //   }
    // });

    return p;
  }
  return {
    createPresenter: createPresenter
  };
}

module.exports = init;
