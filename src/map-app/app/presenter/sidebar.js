"use strict";
const eventbus = require('../eventbus');
const presenter = require('../presenter');
const { BaseSidebarPresenter } = require('./sidebar/base');
const { Stack } = require('../../stack');

export class SidebarPresenter extends BaseSidebarPresenter {
  constructor(view, showDirectoryPanel, showSearchPanel, showAboutPanel, showDatasetsPanel) {
    super();
    this.registerView(view);
    this.contentStack = new Stack();
    this.sidebarWidth = 0;
    this.showDirectoryPanel = showDirectoryPanel;
    this.showSearchPanel = showSearchPanel;
    this.showAboutPanel = showAboutPanel;
    this.showDatasetsPanel = showDatasetsPanel;
    this._eventbusRegister();
  }
  
  changeSidebar(name) {
    this.view.changeSidebar(name);
  }

  showSidebar() {
    this.view.showSidebar();
  }

  showingDirectory() { return this.showDirectoryPanel; }
  showingSearch() { return this.showSearchPanel; }
  showingAbout() { return this.showAboutPanel; }
  showingDatasets() { return this.showDatasetsPanel; }

  hideSidebar(name) {
    this.view.hideSidebar();
  }

  hideInitiativeSidebar(name) {
    this.view.hideInitiativeSidebar();
  }

  hideInitiativeList(name) {
    this.view.hideInitiativeList();
  }

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
        this.updateSidebarWidth(data);
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

  updateSidebarWidth(data) {
    const directoryBounds = data.directoryBounds,
          initiativeListBounds = data.initiativeListBounds;
    this.sidebarWidth =
      directoryBounds.x -
      window.mykoMap.getContainer().getBoundingClientRect().x +
      directoryBounds.width +
        (initiativeListBounds.x -
         window.mykoMap.getContainer().getBoundingClientRect().x >
          0
          ? initiativeListBounds.width
          : 0);
    
    eventbus.publish({
      topic: "Map.setActiveArea",
      data: {
        offset: this.sidebarWidth
      }
    });
  }
  
  getSidebarWidth() {
    return this.sidebarWidth;
  }
  
}


