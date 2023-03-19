import { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import * as postal from 'postal';
import { Initiative } from './app/model/initiative';
import { Box2d, Point2d } from './common-types';
import { arrays2Box2d, yesANumber } from './utils';

/// This defines a typed wrapper to a Postal topic
export class PostalTopic<T = void> {
  constructor(readonly topic: string) {}

  pub(data: T): void { postal.publish({topic: this.topic, data}); }
  sub(callback: (data: T) => void): void { postal.subscribe({topic: this.topic, callback}); }  
}

export namespace EventBus {
  export namespace Datasets {
    //export Data { text: string, results: Initiative[] }
    //export const filterDataset = new PostalEvent<Data>("Datasets.filterDataset");
  }
  export namespace Directory {
	  export const initiativeClicked = new PostalTopic<Initiative|undefined>("Directory.initiativeClicked"); // deselected if undefined
	  export const initiativeClickedHideSidebar = new PostalTopic<Initiative>("Directory.InitiativeClickedSidebar.hideSidebar");
	  export const removeFilters = new PostalTopic<string|undefined>("Directory.removeFilters");
  }
  export namespace Initiatives {
    export interface DatasetError { error: Error; dataset?: string; }
	  export const datasetLoaded = new PostalTopic<string>("Initiatives.datasetLoaded");
    export const loadComplete = new PostalTopic("Initiatives.loadComplete"); 
	  export const loadFailed = new PostalTopic<DatasetError>("Initiatives.loadFailed");
	  export const reset = new PostalTopic("Initiatives.reset");
	  export const loadStarted = new PostalTopic("Initiatives.loadStarted");
  }
  export namespace Initiative {
    export const created = new PostalTopic<Initiative>("Initiative.created");
	  export const refreshed = new PostalTopic<Initiative>("Initiative.refreshed");
	  export const searchedInitiativeClicked = new PostalTopic<Initiative>("Initiative.searchedInitiativeClicked");
	  //export const selected = new PostalTopic<Data>("Initiative.selected");
  }
  export namespace Map {
    export interface ZoomOptions {
      maxZoom?: number;
    }
    export interface ZoomData {
      latlng: LatLngExpression;
      options: ZoomOptions;
      zoom?: number;
    }
    export interface SelectAndZoomData {
      initiatives: Initiative[];
      bounds?: Box2d;
      options: ZoomOptions;
    }
    export interface BoundsData {
      bounds: LatLngBoundsExpression;
      options?: ZoomOptions;
    }
    export interface ActiveArea {
      offset: number;
    }
    export function mkSelectAndZoomData(initiatives: Initiative[], opts: { maxZoom?: number; defaultPos?: Point2d; } = {}): SelectAndZoomData {
      
      const options: ZoomOptions = {};
      if (opts.maxZoom != 0)
        options.maxZoom = opts.maxZoom;
      
      const lats = initiatives.map(x => x.lat ?? opts.defaultPos?.[0]).filter(yesANumber);
      const lngs = initiatives.map(x => x.lng ?? opts.defaultPos?.[1]).filter(yesANumber);
      const bounds = arrays2Box2d(lats, lngs);
      return {
        initiatives: initiatives,
        bounds: bounds,
        options: options,
      };
    }

	  export const fitBounds = new PostalTopic<BoundsData>("Map.fitBounds");
	  export const needToHideInitiativeTooltip = new PostalTopic<Initiative>("Map.needToHideInitiativeTooltip");
	  export const needToShowInitiativeTooltip = new PostalTopic<Initiative>("Map.needToShowInitiativeTooltip");
	  export const needsToBeZoomedAndPanned = new PostalTopic<SelectAndZoomData>("Map.needsToBeZoomedAndPanned");
	  export const selectAndZoomOnInitiative = new PostalTopic<SelectAndZoomData>("Map.selectAndZoomOnInitiative");
	  export const setActiveArea = new PostalTopic<ActiveArea>("Map.setActiveArea");
  }
  export namespace Marker {
	  export const selectionToggled = new PostalTopic<Initiative>("Marker.SelectionToggled");
  }
  export namespace Markers {
	  //export const completed = new PostalTopic<Data>("Markers.completed");
	  export const needToShowLatestSelection = new PostalTopic<Initiative[]>("Markers.needToShowLatestSelection");
  }
  export namespace Sidebar {
	  export const hideInitiative = new PostalTopic("Sidebar.hideInitiative");
	  export const hideInitiativeList = new PostalTopic("Sidebar.hideInitiativeList");
	  export const hideInitiativeSidebar = new PostalTopic("Sidebar.hideInitiativeSidebar");
	  export const hideSidebar = new PostalTopic("Sidebar.hideSidebar");
	  export const showAbout = new PostalTopic("Sidebar.showAbout");
	  export const showDatasets = new PostalTopic("Sidebar.showDatasets");
	  export const showDirectory = new PostalTopic("Sidebar.showDirectory");
	  export const showInitiatives = new PostalTopic("Sidebar.showInitiatives");
	  export const showSidebar = new PostalTopic("Sidebar.showSidebar");
  }
  export namespace Vocabularies {
	  export const loadFailed = new PostalTopic<Error>("Vocabularies.loadFailed");
	  export const loaded = new PostalTopic("Vocabularies.loaded");
  }
}

// Adds a hook on the window object which allows a tap to be added easily
const defaultTap = (data: unknown, envelope: unknown): void => {
  console.log(envelope);
};
const addTap = (tapFn: typeof defaultTap = defaultTap) => { 
  postal.addWireTap(tapFn);
};
// @ts-ignore
if (typeof window === 'object') window['addTap'] = addTap;

