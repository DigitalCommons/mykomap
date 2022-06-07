"use strict";
const eventbus = require('../../eventbus');
const presenter = require('../../presenter');

function init(registry) {
  const config = registry('config');
  
  function Stack() {
    this.index = 0;
    this.storage = [];
  }
  Stack.prototype = {
    append: function(obj) {
      // This implementation behaves like a typical browser - you loose everything beyond the current
      // when you add something new:
      // if (this.index < this.storage.length - 1) {
      //   // There are items beyond the current one, which we shall remove
      //   const itemsToRemove = this.storage.length - this.index;
      //   this.index++;
      //   this.storage.splice(this.index, itemsToRemove, obj);
      // } else {
      //   // Just add the new item to the end
      //   this.storage[this.storage.length] = obj;
      //   this.index = this.storage.length - 1;
      // }

      // This implementation adds things to the very end, so the stack grows and grows:
      this.storage.push(obj);
      this.index = this.storage.length - 1;
    },
    current: function() {
      // returns undefined if the stack is empty
      return this.storage[this.index];
    },
    previous: function() {
      if (this.index > 0) {
        this.index--;
      }
      return this.current();
    },
    next: function() {
      if (this.index < this.storage.length - 1) {
        this.index++;
      }
      return this.current();
    },
    isAtStart: function() {
      return this.storage.length === 0 || this.index === 0;
    },
    isAtEnd: function() {
      return (
        this.storage.length === 0 || this.index === this.storage.length - 1
      );
    },
    gotoEnd: function() {this.index = this.storage.length-1;}
  };

  // Set up the object from which all sidebar presenters are derived:
  function base() {}

  // All sidebar presenters are derived from the base presenter:
  var proto = Object.create(presenter.base.prototype);

  proto.sidebarWidth = 0;

  // Sidebars can manage a stack of content.
  // For example, a sidebar for Search Results may maintain a stack of search results,
  // allowing the possilility of going back/forward through previous/next search results.
  proto.contentStack = new Stack();

  function updateSidebarWidth(data) {
    const directoryBounds = data.directoryBounds,
          initiativeListBounds = data.initiativeListBounds;
    this.sidebarWidth =
      directoryBounds.x -
      window.seaMap.getContainer().getBoundingClientRect().x +
      directoryBounds.width +
       (initiativeListBounds.x -
        window.seaMap.getContainer().getBoundingClientRect().x >
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

  function getSidebarWidth() {
    return this.sidebarWidth;
  }

  proto.backButtonClicked = function() {
    // Closure to retain reference to this
    var pres = this;
    return function() {
      //console.log("backButtonClicked");
      //console.log(pres);
      const lastContent = pres.contentStack.current();
      const newContent = pres.contentStack.previous();
      if (newContent == lastContent)
        return;
      // TODO: Think: maybe better to call a method on pres that indicates thay
      //       the contentStack has been changed.
      //       Then it is up to the pres to perform other actions related to this
      //       (e.g. where it affects which initiatives are selected)
      //pres.view.refresh();

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
  };
  proto.forwardButtonClicked = function() {
    // Closure to retain reference to this
    var pres = this;
    return function() {
      //console.log("forwardButtonClicked");
      //console.log(pres);
      const lastContent = pres.contentStack.current();
      const newContent = pres.contentStack.next();
      if (newContent == lastContent)
        return;
      //pres.view.refresh();
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
      pres.historyButtonsUsed(lastContent);
    };
  };

  // If the sidebar wants to do something more than to get its view to refresh when the history buttons have been used, then
  // it should override this definition with its own:
  proto.historyButtonsUsed = function(lastContent) {
    
    this.view.refresh();
  };

  proto.deselectInitiatives = function(){
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });
  }

  proto.historyNavigation = function() {
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
  };

  base.prototype = proto;

  return {
    base: base,
    updateSidebarWidth: updateSidebarWidth,
    getSidebarWidth: getSidebarWidth
  };
}

module.exports = init;
