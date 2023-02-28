import { EventBus } from '../../eventbus';
import { Stack } from '../../stack';
import { MapUI } from '../mapui';
import { SidebarView } from '../view/sidebar';
import { BasePresenter } from './base';

export class SidebarPresenter extends BasePresenter {
  readonly view: SidebarView;
  readonly contentStack = new Stack();
  readonly showDirectoryPanel: boolean;
  readonly showSearchPanel: boolean;
  readonly showAboutPanel: boolean;
  readonly showDatasetsPanel: boolean;

  constructor(readonly mapui: MapUI) {
    super();
    this.showDirectoryPanel = mapui.config.getShowDirectoryPanel();
    this.showSearchPanel = mapui.config.getShowSearchPanel();
    this.showAboutPanel = mapui.config.getShowAboutPanel();
    this.showDatasetsPanel = mapui.config.getShowDatasetsPanel();
    this.view = new SidebarView(this, mapui.dataServices.getSidebarButtonColour());
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
    EventBus.Sidebar.showInitiatives.sub(() => {
      this.changeSidebar("initiatives");
      this.showSidebar();
    });
    EventBus.Sidebar.showAbout.sub(() => {
      this.changeSidebar("about");
      this.showSidebar();
    });
    EventBus.Sidebar.showDirectory.sub(() => {
      this.changeSidebar("directory");
      this.view.showInitiativeList();
    });
    EventBus.Sidebar.showDatasets.sub(() => {
      this.changeSidebar("datasets");
      this.showSidebar();
    });
    EventBus.Sidebar.showSidebar.sub(() => this.showSidebar());
    EventBus.Sidebar.hideSidebar.sub(() => this.hideSidebar());
    EventBus.Sidebar.hideInitiativeSidebar.sub(() => this.hideInitiativeSidebar());
    EventBus.Sidebar.hideInitiativeList.sub(() => this.hideInitiativeList());
    EventBus.Initiatives.reset.sub(() => this.changeSidebar());
    EventBus.Initiatives.loadComplete.sub(() => this.changeSidebar());
  }

}


