import { EventBus } from '../../../eventbus';
import { BasePresenter }from '../base';
import { BaseSidebarView } from '../../view/sidebar/base';
import { SidebarPresenter } from '../sidebar';
import { Initiative } from '../../model/initiative';

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
  
  /**
   * If the sidebar wants to do something more than to get its view to refresh when the history
   * buttons have been used, then it should override this definition with its own.
   */
  historyButtonsUsed(): void {    
    this.view.refresh(false);
  }

  deselectInitiatives(): void {
    EventBus.Markers.needToShowLatestSelection.pub([]);
  }

  isBackButtonDisabled(): boolean {
    return this.parent.mapui.isAtStart();
  }

  isForwardButtonDisabled(): boolean {
    return this.parent.mapui.isAtEnd();
  }

  onBackButtonClick(): void {
    if (this.parent.mapui.isAtStart())
      return; // do nothing
    this.parent.mapui.back();
    this.historyButtonsUsed();
  }

  onForwardButtonClick(): void {
    if (this.parent.mapui.isAtEnd())
      return; // do nothing
    this.parent.mapui.forward();
    this.historyButtonsUsed();
  }

  /**
   * Refreshes the sidebar view
   * 
   * @param changed true if we changed to this sidebar, false if it was already showing and we're
   * just refreshing it.
   */
  refreshView(changed: boolean) {
    this.view.refresh(changed);
  }

  onInitiativeClicked(initiative: Initiative): void {
    EventBus.Map.initiativeClicked.pub(initiative);
  }

  onInitiativeMouseoverInSidebar(initiative: Initiative): void {
    EventBus.Map.needToShowInitiativeTooltip.pub(initiative);
  }

  onInitiativeMouseoutInSidebar(initiative: Initiative): void {
    EventBus.Map.needToHideInitiativeTooltip.pub(initiative);
  }
}


