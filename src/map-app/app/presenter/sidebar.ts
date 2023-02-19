import { EventBus } from '../../eventbus';
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


