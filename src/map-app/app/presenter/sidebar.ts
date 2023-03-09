import { Dictionary } from '../../common-types';
import { EventBus } from '../../eventbus';
import { StateStack } from '../../search-results';
import { MapUI } from '../map-ui';
import { SidebarView } from '../view/sidebar';
import { BasePresenter } from './base';
import { AboutSidebarPresenter } from './sidebar/about';
import { BaseSidebarPresenter } from './sidebar/base';
import { DatasetsSidebarPresenter } from './sidebar/datasets';
import { DirectorySidebarPresenter } from './sidebar/directory';
import { InitiativesSidebarPresenter } from './sidebar/initiatives';

export class SidebarPresenter extends BasePresenter {
  readonly view: SidebarView;
  readonly contentStack = new StateStack();
  readonly showDirectoryPanel: boolean;
  readonly showSearchPanel: boolean;
  readonly showAboutPanel: boolean;
  readonly showDatasetsPanel: boolean;
  private children: Dictionary<BaseSidebarPresenter> = {};
  private sidebarName?: string;

  constructor(readonly mapui: MapUI) {
    super();
    this.showDirectoryPanel = mapui.config.getShowDirectoryPanel();
    this.showSearchPanel = mapui.config.getShowSearchPanel();
    this.showAboutPanel = mapui.config.getShowAboutPanel();
    this.showDatasetsPanel = mapui.config.getShowDatasetsPanel();
    this.view = new SidebarView(this, mapui.dataServices.getSidebarButtonColour());
    this._eventbusRegister();

    this.createSidebars();
    this.changeSidebar();
  }

  createSidebars() {
    this.children = {};
    
    if(this.showingDirectory())
      this.children.directory = new DirectorySidebarPresenter(this);

    if(this.showingSearch())
      this.children.initiatives = new InitiativesSidebarPresenter(this);

    if(this.showingAbout())
      this.children.about = new AboutSidebarPresenter(this);
    
    if(this.showingDatasets())
      this.children.datasets = new DatasetsSidebarPresenter(this);
  }
  
  // Changes or refreshes the sidebar
  //
  // @param name - the sidebar to change (needs to be one of the keys
  // of this.sidebar)
  changeSidebar(name?: string) {
    if (name !== undefined) {
      // Validate name
      if (!(name in this.children)) {
        console.warn(`ignoring request to switch to non-existant sidebar '${name}'`);
        name = undefined;
      }
    }

    if (name === undefined) {
      // By default, use the first sidebar defined (JS key order is that of first definition)
      const names = Object.keys(this.children);
      
      if (names.length === 0)
        return; // Except in this case, there is nothing we can do!

      name = names[0];
    }
    
    // Change the current sidebar
    this.sidebarName = name;
    this.children[this.sidebarName]?.refreshView();
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


