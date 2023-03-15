import { EventBus } from '../../../eventbus';
import { BasePresenter }from '../base';
import { BaseSidebarView } from '../../view/sidebar/base';
import { SidebarPresenter } from '../sidebar';
import { MapFilter, MapSearch } from '../../map-ui';

export interface NavigationCallback {
  disabled: boolean;
  onClick: () => void;
}

export interface NavigationButtons {
  back: NavigationCallback;
  forward: NavigationCallback;
}


/// This class is a base for sidebar presenters.
export abstract class BaseSidebarPresenter extends BasePresenter {
  abstract readonly view: BaseSidebarView;

  constructor(readonly parent: SidebarPresenter) {
    super();
  }
  
  // If the sidebar wants to do something more than to get its view to refresh when the history buttons have been used, then
  // it should override this definition with its own:
  historyButtonsUsed(): void {    
    this.view.refresh();
  }

  deselectInitiatives(): void {
    EventBus.Markers.needToShowLatestSelection.pub([]);
  }

  historyNavigation(): NavigationButtons {
    return {
      back: {
        disabled: this.parent.contentStack.isAtStart(),
        onClick: () => { this.parent.contentStack.back(); this.historyButtonsUsed(); },
      },
      forward: {
        disabled: this.parent.contentStack.isAtEnd(),
        onClick: () => { this.parent.contentStack.forward(); this.historyButtonsUsed(); },
      },
    };
  }

  /// Refreshes the view
  refreshView() {
    this.view.refresh();
  }
}


