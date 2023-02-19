import { StackItem } from '../../../stack';
import { EventBus } from '../../../eventbus';
import { BasePresenter }from '../../presenter';
import { BaseSidebarView } from '../../view/sidebar/base';
import { SidebarPresenter } from '../sidebar';
import { SearchResults } from './searchresults';

export interface NavigationCallback {
  disabled: boolean;
  onClick: () => void;
}

export interface NavigationButtons {
  back: NavigationCallback;
  forward: NavigationCallback;
}


/// This class is a base for sidebar presenters.
///
/// Weirdly, for historical reasons which are largely unknown
/// at the point of writing this, it has only members on the *prototype*
/// which all derivatives will share... See the static initializer.
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
            initiatives: newContent.initiatives,
            verboseName: filter.verboseName
          };
          EventBus.Map.addFilter.pub(filterData);

        });
      }

      const data: EventBus.Map.Filter = {initiatives: newContent.initiatives};
      EventBus.Map.addSearchFilter.pub(data);

      this.historyButtonsUsed(lastContent);
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
              initiatives: newContent.initiatives,
              verboseName: filter.verboseName
            };
            EventBus.Map.addFilter.pub(filterData);
          });
        }

        const data: EventBus.Map.Filter = {initiatives: newContent.initiatives};
        EventBus.Map.addSearchFilter.pub(data);
      }
      else{
        EventBus.Map.removeSearchFilter.pub();
      }
      this.historyButtonsUsed(lastContent);
    };
  }

  // If the sidebar wants to do something more than to get its view to refresh when the history buttons have been used, then
  // it should override this definition with its own:
  historyButtonsUsed(lastContent?: StackItem): void {    
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
}


