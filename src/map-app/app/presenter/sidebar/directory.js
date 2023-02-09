"use strict";
import * as eventbus from '../../eventbus';
import {  BaseSidebarPresenter  } from './base';

function arrayMax(array) {
  return array.reduce((a, b) => Math.max(a ?? Number.NEGATIVE_INFINITY, b ?? Number.NEGATIVE_INFINITY));
}
function arrayMin(array) {
  return array.reduce((a, b) => Math.min(a ?? Number.POSITIVE_INFINITY, b ?? Number.POSITIVE_INFINITY));
}

export class DirectoryPresenter extends BaseSidebarPresenter {

  constructor(view, config, dataServices, markerView) {
    super();
    this.parent = view.parent.presenter;
    this.config = config;
    this.dataServices = dataServices;
    this.markerView = markerView;
    this.view = view;
  }

  currentItem() {
    return this.parent.contentStack.current();
  }

  getVerboseValuesForFields() {
    return this.dataServices.getVerboseValuesForFields();
  }

  getRegisteredValues() {
    return this.dataServices.getAggregatedData().registeredValues;
  }

  notifyViewToBuildDirectory() {
    this.view.refresh();
  }

  // Gets the initiatives with a selection key, or if absent, gets all the initiatives
  getInitiativesForFieldAndSelectionKey(field, key) {
    if (key == null)
      return this.dataServices.getAggregatedData().loadedInitiatives;
    else
      return this.dataServices.getAggregatedData().registeredValues[field][key];
  }

  getInitiativeByUniqueId(uid) {
    return this.dataServices.getAggregatedData().initiativeByUniqueId[uid];
  }

  doesDirectoryHaveColours() {
    return this.config.doesDirectoryHaveColours();
  }

  notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives) {
    // eventbus.publish({
    //   topic: "Map.fitBounds",
    //   data: {
    //     bounds: boundsс,
    //     options: {
    //       maxZoom: 9
    //     }
    //   }
    // }); //should be doing this

    const lats = initiatives.map(x => x.lat);
    const lngs = initiatives.map(x => x.lng);
    let options = { maxZoom: this.config.getMaxZoomOnGroup() };
    if (initiatives.length == 1)
      options = { maxZoom: this.config.getMaxZoomOnOne() };

    if (options.maxZoom == 0)
      options = {};

    if (initiatives.length > 0) {
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          , options
        }
      });

      //rm for now as it isn't working well enough
    }
  }


  notifyMapNeedsToNeedsToSelectInitiative(initiatives) {
    // eventbus.publish({
    //   topic: "Map.fitBounds",
    //   data: {
    //     bounds: boundsс,
    //     options: {
    //       maxZoom: 9
    //     }
    //   }
    // }); //should be doing this

    let options = { maxZoom: this.config.getMaxZoomOnGroup() };
    if (initiatives.length == 1)
      options = { maxZoom: this.config.getMaxZoomOnOne() };

    if (options.maxZoom == 0)
      options = {};

    const defaultPos = this.config.getDefaultLatLng();
    if (initiatives.length > 0) {
      const lats = initiatives.map(x => x.lat || defaultPos[0]);
      const lngs = initiatives.map(x => x.lng || defaultPos[1]);
      eventbus.publish({
        topic: "Map.selectAndZoomOnInitiative",
        data: {
          initiatives: initiatives,
          bounds: [
            [arrayMin(lats), arrayMin(lngs)],
            [arrayMax(lats), arrayMax(lngs)]
          ]
          , options
        }
      });
    }
  }

  onInitiativeMouseoverInSidebar(initiative) {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  }
  onInitiativeMouseoutInSidebar(initiative) {
    eventbus.publish({
      topic: "Map.needToHideInitiativeTooltip",
      data: initiative
    });
  }

  clearLatestSelection() {
    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });
  }

  removeFilters(filterName = null) {
    //remove specific filter
    if (filterName) {
      eventbus.publish({
        topic: "Map.removeFilter",
        data: {
          filterName: filterName,
          noZoom: true
        }
      });
    } else {
      //remove all filters
      eventbus.publish({
        topic: "Map.removeFilters",
        data: {}
      });
    }
    this.view.d3selectAndClear(
      "#sea-initiatives-list-sidebar-content"
    );
    //clear the window
    eventbus.publish({
      topic: "Sidebar.hideInitiativeList"
    });
    this.clearLatestSelection();
    // const latlng = latLngBounds(null);
    // eventbus.publish({
    //   topic: "Map.needsToBeZoomedAndPanned",
    //   data: {
    //    initiatives: initiatives?,
    //     bounds: latlng,
    //     options: {
    //       maxZoom: 5
    //     }
    //   }
    // });
  }

  initiativeClicked(initiative) {
    if (initiative) {
      //this.parent.contentStack.append(new StackItem([initiative]));
      // Move the window to the right position first
      this.notifyMapNeedsToNeedsToSelectInitiative([initiative]);

      // Populate the sidebar and hoghlight the iitiative in the directory
      this.view.populateInitiativeSidebar(
        initiative,
        this.markerView.getInitiativeContent(initiative)
      );

    } else {
      // User has deselected
      // TODO: This probably shouldn\t be here
      eventbus.publish({
        topic: "Markers.needToShowLatestSelection",
        data: {
          selected: []
        }
      });
      // Deselect the sidebar and hoghlight the iitiative in the directory
      this.view.deselectInitiativeSidebar();

      //doesn't do much?
    }
  }

  latLngBounds(initiatives) {
    return this.dataServices.latLngBounds(initiatives);
  }

  _eventbusRegiter() {
    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: (data) => {
        // User has deselected
        // TODO: This probably shouldn\t be here
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        //todo reload new ones inside instead (without closing)
        eventbus.publish({
          topic: "Sidebar.hideInitiativeList"
        });
      }
    });
    // eventbus.subscribe({topic: "Marker.SelectionToggled", callback: function(data) { p.onMarkerSelectionToggled(data); } });
    // eventbus.subscribe({topic: "Marker.SelectionSet", callback: function(data) { p.onMarkerSelectionSet(data); } });
    eventbus.subscribe({
      topic: "Directory.InitiativeClicked",
      callback: (data) => {
        this.initiativeClicked(data);
      }
    });
    eventbus.subscribe({
      topic: "Directory.removeFilters",
      callback: (data) => {
        this.removeFilters(data);
      }
    });
  }
  
}
