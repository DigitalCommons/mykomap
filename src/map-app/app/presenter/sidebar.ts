import { Dictionary } from '../../common-types';
import { EventBus } from '../../eventbus';
import { MapUI } from '../map-ui';
import { Initiative } from '../model/initiative';
import { SidebarView } from '../view/sidebar';
import { BasePresenter } from './base';
import { AboutSidebarPresenter } from './sidebar/about';
import { BaseSidebarPresenter } from './sidebar/base';
import { DatasetsSidebarPresenter } from './sidebar/datasets';
import { DirectorySidebarPresenter } from './sidebar/directory';
import { InitiativesSidebarPresenter } from './sidebar/initiatives';

export class SidebarPresenter extends BasePresenter {
  readonly view: SidebarView;
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

    if (name !== undefined) {
      // If name is set, change the current sidebar and then refresh
      this.sidebarName = name;
      this.children[this.sidebarName]?.refreshView(true);
    }
    else {
      // Just refresh the currently showing sidebar.
      // If nothing is showing, show the first. Or nothing, if none.
      if (!this.sidebarName) {
        const names = Object.keys(this.children);
        if (names.length > 0)
          this.sidebarName = names[0];
        else
          return; // No sidebars? Can't do anything.
      }
        
      this.children[this.sidebarName]?.refreshView(false);
    }
  }

  showSidebar() {
    // Refresh the view before showing
    this.children[this.sidebarName ?? 'undefined']?.refreshView(true);
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

  populateInitiativeSidebar(initiative: Initiative, initiativeContent: string) {
    this.view.populateInitiativeSidebar(initiative, initiativeContent);
  }

  showInitiativeList() {
    this.view.showInitiativeList();
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
      this.showSidebar();
    });
    EventBus.Sidebar.showDatasets.sub(() => {
      this.changeSidebar("datasets");
      this.showSidebar();
    });
    EventBus.Sidebar.showSidebar.sub(() => this.showSidebar());
    EventBus.Sidebar.hideSidebar.sub(() => this.hideSidebar());
    EventBus.Sidebar.hideInitiativeSidebar.sub(() => this.hideInitiativeSidebar());
    EventBus.Sidebar.showInitiativeList.sub(() => this.showInitiativeList());
    EventBus.Sidebar.hideInitiativeList.sub(() => this.hideInitiativeList());
    EventBus.Initiatives.reset.sub(() => {
      this.changeSidebar();
      this.hideInitiativeList();
    });
    EventBus.Initiatives.loadComplete.sub(() => this.changeSidebar());
  }

}


