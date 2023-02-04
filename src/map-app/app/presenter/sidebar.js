"use strict";
const eventbus = require('../eventbus');
const presenter = require('../presenter');
const { BaseSidebarPresenter } = require('./sidebar/base');

export class SidebarPresenter extends BaseSidebarPresenter {
  constructor(view, showDirectoryPanel, showSearchPanel, showAboutPanel, showDatasetsPanel) {
    super();
    this.registerView(view);
    this.showDirectoryPanel = showDirectoryPanel;
    this.showSearchPanel = showSearchPanel;
    this.showAboutPanel = showAboutPanel;
    this.showDatasetsPanel = showDatasetsPanel;
    this._eventbusRegister();
  }
  
  changeSidebar(name) {
    this.view.changeSidebar(name);
  };

  showSidebar() {
    this.view.showSidebar();
  };

  showingDirectory() { return this.showDirectoryPanel; }
  showingSearch() { return this.showSearchPanel; }
  showingAbout() { return this.showAboutPanel; }
  showingDatasets() { return this.showDatasetsPanel; }

  hideSidebar(name) {
    this.view.hideSidebar();
  };

  hideInitiativeSidebar(name) {
    this.view.hideInitiativeSidebar();
  };

  hideInitiativeList(name) {
    this.view.hideInitiativeList();
  };

  _eventbusRegister() {
    eventbus.subscribe({
      topic: "Sidebar.showInitiatives",
      callback: () => {
        this.changeSidebar("initiatives");
        this.showSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.showAbout",
      callback: () => {
        this.changeSidebar("about");
        this.showSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.showDirectory",
      callback: () => {
        this.changeSidebar("directory");
        this.viewshowInitiativeList();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.showDatasets",
      callback: () => {
        this.changeSidebar("datasets");
        this.showSidebar();
      }
    });


    eventbus.subscribe({
      topic: "Sidebar.showSidebar",
      callback: () => {
        this.showSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.hideSidebar",
      callback: () => {
        this.hideSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.hideInitiativeSidebar",
      callback: () => {
        this.hideInitiativeSidebar();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.hideInitiativeList",
      callback: () => {
        this.hideInitiativeList();
      }
    });

    eventbus.subscribe({
      topic: "Sidebar.updateSidebarWidth",
      callback: (data) => {
        BaseSidebarPresenter.updateSidebarWidth(data);
      }
    });

    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: (data) => {
        this.changeSidebar();
      }
    });
    
    eventbus.subscribe({
      topic: "Initiative.complete",
      callback: (data) => {
        this.changeSidebar();
      }
    });

    // eventbus.subscribe({
    //   topic: "Initiative.selected",
    //   callback: () => {
    //     this.viewhideSidebarIfItTakesWholeScreen();
    //   }
    // });
  }

}

  
