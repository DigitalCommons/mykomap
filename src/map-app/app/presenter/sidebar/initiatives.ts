import { EventBus } from '../../../eventbus';
import { InitiativesSidebarView } from '../../view/sidebar/initiatives';
import { BaseSidebarPresenter } from './base';
import { SearchResults } from '../../../search-results';
import { Initiative } from '../../model/initiative';
import { compactArray, toString as _toString } from '../../../utils';
import { SidebarPresenter } from '../sidebar';

export class InitiativesSidebarPresenter extends BaseSidebarPresenter {
  readonly view: InitiativesSidebarView;
  
  _eventbusRegister(): void {
    EventBus.Marker.selectionToggled.sub(initiative => this.onMarkerSelectionToggled(initiative));
    EventBus.Initiative.searchedInitiativeClicked.sub(initiative => this.searchedInitiativeClicked(_toString(initiative.uri, undefined)));
  }

  constructor(readonly parent: SidebarPresenter) {
    super(parent);
    this.view = new InitiativesSidebarView(this);
    this._eventbusRegister();
  }

  currentItem() {
    return this.parent.mapui.currentItem();
  }

  changeFilters(propName: string, value?: string) {
    this.parent.mapui.changeFilters(propName, value);
  }
  
  notifyShowInitiativeTooltip(initiative: Initiative) {
    EventBus.Map.needToShowInitiativeTooltip.pub(initiative);
  }

  notifyHideInitiativeTooltip(initiative: Initiative) {
    EventBus.Map.needToHideInitiativeTooltip.pub(initiative);
  }

  historyButtonsUsed() {
    //console.log("sidebar/initiatives historyButtonsUsed");
    //console.log(lastContent);
    //this.notifyMarkersNeedToShowNewSelection(lastContent);
    this.view.refresh();
  }

  initClicked(initiative: Initiative) {
    EventBus.Directory.initiativeClicked.pub(initiative);
    if (window.outerWidth <= 800) {
      EventBus.Directory.initiativeClickedHideSidebar.pub(initiative);
    }
  }
  
  onInitiativeMouseoverInSidebar(initiative: Initiative) {
    this.notifyShowInitiativeTooltip(initiative);
  }

  onInitiativeMouseoutInSidebar(initiative: Initiative) {
    this.notifyHideInitiativeTooltip(initiative);
  }
  
  onMarkerSelectionToggled(initiative: Initiative) {
    this.parent.mapui.toggleSelectInitiative(initiative);
    this.view.refresh();
  }

  searchedInitiativeClicked(uri?: string) {
    if (uri) this.view.onInitiativeClicked(uri);
  }

  performSearch(text: string) {
    this.parent.mapui.performSearch(text);
  }

  resetSearch() {
    this.parent.mapui.resetSearch();
  }

  changeSearchText(txt: string) {
    this.view.changeSearchText(txt);
  }
}

