import * as eventbus from '../eventbus';
import { Stack } from '../../stack';
import { SidebarView } from '../view/sidebar';
import { BasePresenter } from '../presenter';

export class SidebarPresenter extends BasePresenter {
  readonly contentStack = new Stack();

  constructor(readonly view: SidebarView,
              readonly showDirectoryPanel: boolean,
              readonly showSearchPanel: boolean,
              readonly showAboutPanel: boolean,
              readonly showDatasetsPanel: boolean) {
    super();
    this._eventbusRegister();
  }
  
  changeSidebar(name?: string) {
    this.view.changeSidebar(name);
  }

  showSidebar() {
    this.view.showSidebar();
  }

  showingDirectory(): boolean { return this.showDirectoryPanel; }
  showingSearch(): boolean { return this.showSearchPanel; }
  showingAbout(): boolean { return this.showAboutPanel; }
  showingDatasets(): boolean { return this.showDatasetsPanel; }

  hideSidebar() {
    this.view.hideSidebar();
  }

  hideInitiativeSidebar() {
    this.view.hideInitiativeSidebar();
  }

  hideInitiativeList() {
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
        this.view.showInitiativeList();
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
    //     this.view.hideSidebarIfItTakesWholeScreen();
    //   }
    // });
  }

}


