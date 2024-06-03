import { EventBus } from '../../eventbus';
import { MapUI } from '../map-ui';
import { Initiative } from '../model/initiative';
import { SidebarView } from '../view/sidebar';
import { BasePresenter } from './base';
import { AboutSidebarPresenter } from './sidebar/about';
import { DatasetsSidebarPresenter } from './sidebar/datasets';
import { DirectorySidebarPresenter } from './sidebar/directory';
import { InitiativesSidebarPresenter } from './sidebar/initiatives';

/// A collection of sidebar panels, by name
export class SidebarPanels {
  directory?: DirectorySidebarPresenter = undefined;
  initiatives?: InitiativesSidebarPresenter = undefined;
  about?: AboutSidebarPresenter = undefined;
  datasets?: DatasetsSidebarPresenter = undefined;

  // A list of the IDs as a convenience 
  static readonly ids = Object.keys(new SidebarPanels()) as SidebarId[];
}

/// This type can contain only sidebar ID names
export type SidebarId = keyof SidebarPanels;

export class SidebarPresenter extends BasePresenter {
  readonly view: SidebarView;
  readonly showDirectoryPanel: boolean;
  readonly showSearchPanel: boolean;
  readonly showAboutPanel: boolean;
  readonly showDatasetsPanel: boolean;
  private readonly children = new SidebarPanels();

  private sidebarName?: SidebarId;

  constructor(readonly mapui: MapUI) {
    super();
    this.showDirectoryPanel = mapui.config.getShowDirectoryPanel();
    this.showSearchPanel = mapui.config.getShowSearchPanel();
    this.showAboutPanel = mapui.config.getShowAboutPanel();
    this.showDatasetsPanel = mapui.config.getShowDatasetsPanel();
    const defaultPanel = mapui.config.getDefaultPanel();
    this.view = new SidebarView(
      this,
      mapui.dataServices.getSidebarButtonColour()
    );
    this._eventbusRegister();

    if(this.showingDirectory())
      this.children.directory = new DirectorySidebarPresenter(this);

    if(this.showingSearch())
      this.children.initiatives = new InitiativesSidebarPresenter(this);

    if(this.showingAbout())
      this.children.about = new AboutSidebarPresenter(this);
    
    if(this.showingDatasets())
      this.children.datasets = new DatasetsSidebarPresenter(this);

    this.changeSidebar(defaultPanel);
  }

  /**
   * Changes the sidebar
   * @param name the sidebar to change (needs to be one of the keys of this.sidebar)
   */
  changeSidebar(name?: SidebarId): void {
    if (!name) {
      if (this.sidebarName) {
        // Just refresh the currently showing sidebar.
        this.children[this.sidebarName]?.refreshView(false);
      }
      else {
        // If no sidebar is set, pick the first one
        let key: SidebarId;
        for(key in this.children) {
          const child = this.children[key];
          if (!child)
            continue;
          
          this.sidebarName = key;
          child.refreshView(true);
          break;
        }
        console.warn('No sidebars to show');
      }
      return;
    }

    if (name in this.children) {
      // A valid SidebarId. If it's present, change the current sidebar to that, and then refresh
      const child = this.children[name];
      if (child !== undefined) {
        this.sidebarName = name;
        child.refreshView(true);
      }
      return;
    }

    // If we get here it's not a valid sidebar (possibly it wasn't configured)
    console.warn(
      "Attempting to call SidebarPresenter.changeSidebar() with a "+
        `non-existant sidebar '${name}' - ignoring.`
    );
  }

  /**
   * Fully refresh the sidebar
   */
  refreshSidebar() {
    if (this.sidebarName) {
      this.children[this.sidebarName]?.refreshView(true);
    } else {
      // If no sidebar is set, pick the first one
      let key: SidebarId;
      for(key in this.children) {
        const child = this.children[key];
        if (!child)
          continue;
        
        this.sidebarName = key;
        child.refreshView(true);
        break;
      }
      console.warn('No sidebars to show');
    }

    // If we get here it's not a valid sidebar (possibly it wasn't configured)
    console.warn(
      "Attempting to call SidebarPresenter.changeSidebar() with a "+
        `non-existant sidebar '${name}' - ignoring.`
    );
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
    EventBus.Sidebar.showInitiativeList.sub(() => this.showInitiativeList());
    EventBus.Sidebar.hideInitiativeList.sub(() => this.hideInitiativeList());
    EventBus.Initiatives.reset.sub(() => {
      this.changeSidebar();
      this.hideInitiativeList();
    });
  }

}


