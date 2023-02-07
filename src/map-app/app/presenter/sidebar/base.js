import * as eventbus from '../../eventbus';
import { base as BasePresenter }from '../../presenter';
import { Stack } from '../../../stack';

/// This class is a base for sidebar presenters.
///
/// Weirdly, for historical reasons which are largely unknown
/// at the point of writing this, it has only members on the *prototype*
/// which all derivatives will share... See the static initializer.
export class BaseSidebarPresenter extends BasePresenter {

  constructor(parent) {
    super();
    this.parent = parent;
  }

  backButtonClicked() {
    return () => {
      //console.log("backButtonClicked");
      //console.log(this);
      const lastContent = this.parent.contentStack.current();
      const newContent = this.parent.contentStack.previous();
      if (newContent == lastContent)
        return;
      // TODO: Think: maybe better to call a method on this that indicates thay
      //       the contentStack has been changed.
      //       Then it is up to the this to perform other actions related to this
      //       (e.g. where it affects which initiatives are selected)
      //this.view.refresh();

      eventbus.publish({
        topic: "Map.removeFilters",
      });

      if(newContent.filters[0]){    
        newContent.filters.forEach(filter=>{
          let filterData = {
            filterName: filter.filterName,
            initiatives: newContent.initiatives,
            verboseName: filter.verboseName
          };
          eventbus.publish({
            topic: "Map.addFilter",
            data: filterData
          });
        });
      }

      eventbus.publish({
        topic: "Map.addSearchFilter",
        data: {initiatives: newContent.initiatives}
      }); //historySEARCH

      this.historyButtonsUsed(lastContent);
    };
  }
  
  forwardButtonClicked() {
    return () => {
      //console.log("forwardButtonClicked");
      //console.log(this);
      const lastContent = this.parent.contentStack.current();
      const newContent = this.parent.contentStack.next();
      if (newContent == lastContent)
        return;
      //this.view.refresh();
      if(newContent){
        eventbus.publish({
          topic: "Map.removeFilters",
        });

        if(newContent.filters[0]){     
          newContent.filters.forEach(filter=>{
            let filterData = {
              filterName: filter.filterName,
              initiatives: newContent.initiatives,
              verboseName: filter.verboseName
            };
            eventbus.publish({
              topic: "Map.addFilter",
              data: filterData
            });
          });
        }

        eventbus.publish({
          topic: "Map.addSearchFilter",
          data: {initiatives: newContent.initiatives}
        }); //historySEARCH
      }else{
        eventbus.publish({
          topic: "Map.removeSearchFilter",
          data: {}
        });
      }
      this.historyButtonsUsed(lastContent);
    };
  }

  // If the sidebar wants to do something more than to get its view to refresh when the history buttons have been used, then
  // it should override this definition with its own:
  historyButtonsUsed(lastContent) {
    
    this.view.refresh();
  }

  deselectInitiatives(){
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });
  }

  historyNavigation() {
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


