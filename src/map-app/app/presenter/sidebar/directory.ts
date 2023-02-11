import { Box2d, Dictionary } from '../../../common_types';
import { StackItem } from '../../../stack';
import * as eventbus from '../../eventbus';
import { Config } from '../../model/config';
import { DataServices, Initiative } from '../../model/dataservices';
import { SelectAndZoomData, ZoomOption } from '../../view/map';
import { MarkerViewFactory } from '../../view/map/marker';
import { DirectorySidebarView } from '../../view/sidebar/directory';
import { BaseSidebarPresenter } from './base';

function arrayMax(array: number[]) {
  return array.reduce((a, b) => Math.max(a ?? Number.NEGATIVE_INFINITY, b ?? Number.NEGATIVE_INFINITY));
}
function arrayMin(array: number[]) {
  return array.reduce((a, b) => Math.min(a ?? Number.POSITIVE_INFINITY, b ?? Number.POSITIVE_INFINITY));
}

export class DirectorySidebarPresenter extends BaseSidebarPresenter {

  constructor(readonly view: DirectorySidebarView, readonly config: Config, readonly dataServices: DataServices, readonly markerView: MarkerViewFactory) {
    super(view.parent.presenter);
  }

  currentItem(): StackItem | undefined {
    return this.parent.contentStack.current();
  }

  getVerboseValuesForFields(): Dictionary<Dictionary> {
    return this.dataServices.getVerboseValuesForFields();
  }

  getRegisteredValues(): Dictionary<Dictionary<Initiative[]>> {
    return this.dataServices.getAggregatedData().registeredValues;
  }

  notifyViewToBuildDirectory(): void {
    this.view.refresh();
  }

  // Gets the initiatives with a selection key, or if absent, gets all the initiatives
  getInitiativesForFieldAndSelectionKey(field: string, key?: string): Initiative[] {
    if (key == null)
      return this.dataServices.getAggregatedData().loadedInitiatives;
    else
      return this.dataServices.getAggregatedData().registeredValues[field]?.[key] ?? [];
  }

  getInitiativeByUniqueId(uid: string): Initiative | undefined {
    return this.dataServices.getAggregatedData().initiativesByUid[uid];
  }

  doesDirectoryHaveColours() {
    return this.config.doesDirectoryHaveColours();
  }

  notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives: Initiative[]): void {
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
    let options: ZoomOption = { maxZoom: this.config.getMaxZoomOnGroup() };
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


  notifyMapNeedsToNeedsToSelectInitiative(initiatives: Initiative[]): void {
    // eventbus.publish({
    //   topic: "Map.fitBounds",
    //   data: {
    //     bounds: boundsс,
    //     options: {
    //       maxZoom: 9
    //     }
    //   }
    // }); //should be doing this

    let options: ZoomOption = { maxZoom: this.config.getMaxZoomOnGroup() };
    if (initiatives.length == 1)
      options = { maxZoom: this.config.getMaxZoomOnOne() };

    if (options.maxZoom == 0)
      options = {};

    const defaultPos = this.config.getDefaultLatLng();
    if (initiatives.length > 0) {
      const lats = initiatives.map(x => x.lat || defaultPos[0]);
      const lngs = initiatives.map(x => x.lng || defaultPos[1]);
      const data: SelectAndZoomData = {
        initiatives: initiatives,
        bounds: [
          [arrayMin(lats), arrayMin(lngs)],
          [arrayMax(lats), arrayMax(lngs)]
        ]
        , options
      };
      eventbus.publish({
        topic: "Map.selectAndZoomOnInitiative",
        data: data
      });
    }
  }

  onInitiativeMouseoverInSidebar(initiative: Initiative): void {
    eventbus.publish({
      topic: "Map.needToShowInitiativeTooltip",
      data: initiative
    });
  }
  onInitiativeMouseoutInSidebar(initiative: Initiative): void {
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

  removeFilters(filterName?: string) {
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

  initiativeClicked(initiative: Initiative): void {
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

  latLngBounds(initiatives: Initiative[]): Box2d  {
    return this.dataServices.latLngBounds(initiatives);
  }

  _eventbusRegiter() {
    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: (_) => {
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
