import * as eventbus from '../../eventbus';
import { base as BasePresenter }from '../../presenter';
import { Stack } from '../../../stack';

/// This class is a base for sidebar presenters.
///
/// Weirdly, for historical reasons which are largely unknown
/// at the point of writing this, it has only members on the *prototype*
/// which all derivatives will share... See the static initializer.
export class SidebarPresenter extends BasePresenter {

  static {
    // This static initialiser is a new ES feature.
    // Using it we can emulate setting properties on the class prototype, which
    // all inherited class instances will share... This isn't the same
    // as a static member, as this is not a property of instances,
    // derived or otherwise. This is here to keep the class semantics close to what was
    // present before ES classes were introduced to the code.
    
    this.prototype.sidebarWidth = 0;
    
    /// A stack of content.
    ///
    /// Sidebars can manage a stack of content.
    /// For example, a sidebar for Search Results may maintain a stack of search results,
    /// allowing the possilility of going back/forward through previous/next search results.
    this.prototype.contentStack = new Stack();
  }
  
  constructor() {
    super();
  }

  static updateSidebarWidth(data) {
    const directoryBounds = data.directoryBounds,
          initiativeListBounds = data.initiativeListBounds;
    this.sidebarWidth =
      directoryBounds.x -
      window.mykoMap.getContainer().getBoundingClientRect().x +
      directoryBounds.width +
        (initiativeListBounds.x -
         window.mykoMap.getContainer().getBoundingClientRect().x >
          0
          ? initiativeListBounds.width
          : 0);
    
    eventbus.publish({
      topic: "Map.setActiveArea",
      data: {
        offset: this.sidebarWidth
      }
    });
  }
  
  static getSidebarWidth() {
    return this.sidebarWidth;
  }

  backButtonClicked() {
    return () => {
      //console.log("backButtonClicked");
      //console.log(this);
      const lastContent = this.contentStack.current();
      const newContent = this.contentStack.previous();
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

      pres.historyButtonsUsed(lastContent);
    };
  }
  
  forwardButtonClicked() {
    return () => {
      //console.log("forwardButtonClicked");
      //console.log(this);
      const lastContent = this.contentStack.current();
      const newContent = this.contentStack.next();
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
        disabled: this.contentStack.isAtStart(),
        onClick: this.backButtonClicked()
      },
      forward: {
        disabled: this.contentStack.isAtEnd(),
        onClick: this.forwardButtonClicked()
      }
    };
  }
}


