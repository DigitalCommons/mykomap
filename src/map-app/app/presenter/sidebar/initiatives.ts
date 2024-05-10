import { EventBus } from '../../../eventbus';
import { InitiativesSidebarView } from '../../view/sidebar/initiatives';
import { BaseSidebarPresenter } from './base';
import { Initiative } from '../../model/initiative';
import { toString as _toString } from '../../../utils';
import { SidebarPresenter } from '../sidebar';

export class InitiativesSidebarPresenter extends BaseSidebarPresenter {
  readonly view: InitiativesSidebarView;
  
  _eventbusRegister(): void {
    EventBus.Marker.selectionToggled.sub(initiative => this.onMarkerSelectionToggled(initiative));
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

  onMarkerSelectionToggled(initiative: Initiative) {
    this.parent.mapui.toggleSelectInitiative(initiative);
    this.view.refresh(false);
  }

  performSearch(text: string) {
    this.parent.mapui.performSearch(text);
  }

  changeSearchText(txt: string) {
    this.view.changeSearchText(txt);
  }
}

