import { EventBus } from '../../../eventbus';
import { BasePresenter }from '../base';
import { BaseSidebarView } from '../../view/sidebar/base';
import { SidebarPresenter } from '../sidebar';

export interface NavigationCallback {
  disabled: boolean;
  onClick: () => void;
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

  isBackButtonDisabled(): boolean {
    return this.parent.mapui.contentStack.isAtStart();
  }

  isForwardButtonDisabled(): boolean {
    return this.parent.mapui.contentStack.isAtEnd();
  }

  onBackButtonClick(): void {
    this.parent.mapui.contentStack.back();
    this.historyButtonsUsed();
  }

  onForwardButtonClick(): void {
    this.parent.mapui.contentStack.forward();
    this.historyButtonsUsed();
  }

  /// Refreshes the view
  refreshView() {
    this.view.refresh();
  }
}


