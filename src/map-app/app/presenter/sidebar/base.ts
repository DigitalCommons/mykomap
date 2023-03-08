import { StackItem } from '../../../stack';
import { EventBus } from '../../../eventbus';
import { BasePresenter }from '../base';
import { BaseSidebarView } from '../../view/sidebar/base';
import { SidebarPresenter } from '../sidebar';
import { SearchResults } from '../../../search-results';

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

  backButtonClicked(): () => void {
    return () => {
      //console.log("backButtonClicked");
      //console.log(this);
      const lastContent = this.parent.contentStack.current();
      const newContent = this.parent.contentStack.previous();
      if (!newContent || newContent == lastContent)
        return;
      
      // TODO: Think: maybe better to call a method on this that indicates thay
      //       the contentStack has been changed.
      //       Then it is up to the this to perform other actions related to this
      //       (e.g. where it affects which initiatives are selected)
      //this.view.refresh();

      EventBus.Map.removeFilters.pub();

      if(newContent instanceof SearchResults && newContent.filters[0]){    
        newContent.filters.forEach(filter=>{
          let filterData: EventBus.Map.Filter = {
            filterName: filter.filterName,
            result: newContent.initiatives,
            verboseName: filter.verboseName
          };
          EventBus.Map.addFilter.pub(filterData);
        });
      }

      const data: EventBus.Map.Filter = { result: newContent.initiatives };
      EventBus.Map.addSearchFilter.pub(data);

      this.historyButtonsUsed();
    };
  }
  
  forwardButtonClicked(): () => void {
    return () => {
      //console.log("forwardButtonClicked");
      //console.log(this);
      const lastContent = this.parent.contentStack.current();
      const newContent = this.parent.contentStack.next();
      if (newContent == lastContent)
        return;
      //this.view.refresh();
      if(newContent && newContent instanceof SearchResults){
        EventBus.Map.removeFilters.pub();

        if(newContent.filters[0]){     
          newContent.filters.forEach(filter=>{
            let filterData: EventBus.Map.Filter = {
              filterName: filter.filterName,
              result: newContent.initiatives,
              verboseName: filter.verboseName
            };
            EventBus.Map.addFilter.pub(filterData);
          });
        }

        const data: EventBus.Map.Filter = { result: newContent.initiatives };
        EventBus.Map.addSearchFilter.pub(data);
      }
      else{
        EventBus.Map.removeSearchFilter.pub();
      }
      this.historyButtonsUsed();
    };
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
        onClick: this.backButtonClicked()
      },
      forward: {
        disabled: this.parent.contentStack.isAtEnd(),
        onClick: this.forwardButtonClicked()
      }
    };
  }

  /// Refreshes the view
  refreshView() {
    this.view.refresh();
  }
}


