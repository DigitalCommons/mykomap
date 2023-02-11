import { BasePresenter } from '../presenter';
import * as d3 from 'd3';
import * as eventbus from '../eventbus';
import * as leaflet from 'leaflet';
import { Config } from '../model/config_schema';
import { DataServices, Initiative, Filter } from '../model/dataservices';
import { MarkerViewFactory } from '../view/map/marker';
import { SidebarView } from '../view/sidebar';
import { Dictionary } from '../../common_types';
import { MapView, SelectAndZoomData, Map, BoundsData, ZoomOption } from '../view/map';
import { Marker } from 'leaflet';


// Cater for the earlier JS hack in which a boolean is stored in
// marker objects...
interface ExtendedMarker extends Marker {
  hasPhysicalLocation: boolean;
}

export class MapPresenterFactory {
  initiativesOutsideOfFilterUIDMap: Dictionary<Initiative> = {};
  public loadedInitiatives: Initiative[] = [];
  filtered: Dictionary<Initiative[]> = {};
  filteredInitiativesUIDMap: Dictionary<Initiative> = {};
  verboseNamesMap: Dictionary = {};
  hidden: Initiative[] = [];
  allMarkers: Marker[] = [];
  public map?: Map;
  
  constructor(readonly config: Config,
              readonly dataservices: DataServices,
              readonly markerView: MarkerViewFactory,
              // for deferred load of sidebarView - breaking a recursive dep
              readonly getSidebarView: (f: MapPresenterFactory) => Promise<SidebarView> ) {
  }

  onNewInitiatives() {
    this.initiativesOutsideOfFilterUIDMap = Object.assign(
      {}, this.dataservices.getAggregatedData().initiativesByUid
    );
    this.loadedInitiatives = this.dataservices.getAggregatedData().loadedInitiatives;
  }
  
  createPresenter(view: MapView): MapPresenter {
    const p = new MapPresenter(this, view);
    eventbus.subscribe({
      topic: "Initiative.datasetLoaded",
      callback: () => {
        this.onNewInitiatives();
        p.onInitiativeDatasetLoaded();
      }
    });
    eventbus.subscribe({
      topic: "Initiative.new",
      callback: (data) => {
        p.onInitiativeNew(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.refresh",
      callback: (data) => {
        this.onNewInitiatives();
        p.refreshInitiative(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.reset",
      callback: (data) => {
        this.onNewInitiatives();
        p.onInitiativeReset(data);
      }
    });
    eventbus.subscribe({
      topic: "Initiative.complete",
      callback: () => {
        this.onNewInitiatives();
        p.onInitiativeLoadComplete();
        p.onInitiativeComplete();
      }
    });

    eventbus.subscribe({
      topic: "Initiative.loadStarted",
      callback: (data: { message: string, error?: string }) => {
        p.onInitiativeLoadMessage(data);
      }
    });


    eventbus.subscribe({
      topic: "Initiative.loadFailed",
      callback: (data) => {
        p.onInitiativeLoadMessage(data);
      }
    });
    // TODO - strip out this mechanism from everywhere it appears:
    //eventbus.subscribe({topic: "Initiative.selected", callback: (data) => { p.onInitiativeSelected(data); } });
    eventbus.subscribe({
      topic: "Markers.needToShowLatestSelection",
      callback: (data: { selected: Initiative[] }) => {
        p.onMarkersNeedToShowLatestSelection(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.needsToBeZoomedAndPanned",
      callback: (data) => {
        p.onMapNeedsToBeZoomedAndPanned(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.needToShowInitiativeTooltip",
        callback: (data: Initiative) => {
        p.onNeedToShowInitiativeTooltip(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.needToHideInitiativeTooltip",
      callback: (data) => {
        p.onNeedToHideInitiativeTooltip(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.setZoom",
      callback: (data) => {
        p.setZoom(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.setActiveArea",
      callback: (data) => {
        p.setActiveArea(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.fitBounds",
      callback: (data: BoundsData) => {
        p.onBoundsRequested(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.selectAndZoomOnInitiative",
      callback: (data) => {
        p.selectAndZoomOnInitiative(data);
      }
    });



    eventbus.subscribe({
      topic: "Map.addFilter", //change this
      callback: (data: Filter) => {
        p.addFilter(data);
      }
    });
    eventbus.subscribe({
      topic: "Map.refresh", //change this
      callback: (data) => {
        p.view.refresh();
      }
    });

    eventbus.subscribe({
      topic: "Map.removeFilter",
      callback: (data: Filter) => {
        p.removeFilter(data);
      }
    });

    eventbus.subscribe({
      topic: "Map.removeFilters",
      callback: (data) => {
        p.removeFilters();
      }
    });

    eventbus.subscribe({
      topic: "Map.addSearchFilter",
      callback: (data) => {
        p.addSearchFilter(data);
      }
    });//change this to search

    eventbus.subscribe({
      topic: "Map.removeSearchFilter",
      callback: (data) => {
        p.removeSearchFilter();
      }
    });

    return p;
  }
  
  //should return an array of unique initiatives in filters
  getFiltered() {
    return Object.values(this.filteredInitiativesUIDMap);
  }

  getFilteredMap() {
    return this.filteredInitiativesUIDMap;
  }

  getFilters(){
    return Object.keys(this.filtered);
  }

  getFiltersFull(): Filter[] {
    const filterArray: Filter[] = []
    
    for(let filterName in this.verboseNamesMap){
      filterArray.push({
        filterName: filterName,
        verboseName: this.verboseNamesMap[filterName] ?? '',
        initiatives: this.filtered[filterName] ?? []
      })
    }

    return filterArray;
  }

  getFiltersVerbose(): string[] {
    return Object.values(this.verboseNamesMap)
      .filter((i): i is string => i !== undefined);
  }
}

export class MapPresenter extends BasePresenter {
  previouslySelected: Initiative[] = [];
  
  constructor(readonly factory: MapPresenterFactory, readonly view: MapView) {
    super();
  }
    
  static copyTextToClipboard(text: string) {
    const body = d3.select(document.body)
    const textArea = body.append("textarea")
      .attr(
        "style",
        // Place in top-left corner of screen regardless of scroll position.
        "position: fixed; top: 0; left: 0; "+
          // Ensure it has a small width and height. Setting to 1px / 1em
          // doesn't work as this gives a negative w/h on some browsers.
          "width: 2em; height: 2em; "+
          // We don't need padding, reducing the size if it does flash render.
          "padding: 0; "+
          // Clean up any borders.          
          "border: none; outline: none; box-shadow: none; "+
          // Avoid flash of white box if rendered for any reason.
          "background: transparent"
           )
      .attr("value", text)
    
    // ***taken from https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript?page=1&tab=votes#tab-top ***
    //
    // *** This styling is an extra step which is likely not required. ***
    //
    // Why is it here? To ensure:
    // 1. the element is able to have focus and selection.
    // 2. if element was to flash render it has minimal visual impact.
    // 3. less flakyness with selection and copying which **might** occur if
    //    the textarea element is not visible.
    //
    // The likelihood is the element won't even render, not even a
    // flash, so some of these are just precautions. However in
    // Internet Explorer the element is visible whilst the popup
    // box asking the user for permission for the web page to
    // copy to the clipboard.
    //

    textArea.node()?.focus();
    textArea.node()?.select();

    try {
      document.execCommand('copy'); // FIXME this method has been deprecated!
    } catch (err) {
      console.log('Oops, unable to copy', err);
    }

    textArea.remove()
  }

  getTileUrl() {
    return this.factory.config.getTileUrl();
  }
  
  getMapAttribution() {
    return this.factory.config.getMapAttribution();
  }
  
  getMapEventHandlers(): Dictionary<leaflet.LeafletEventHandlerFn> {
    return {
      click: (e: leaflet.LeafletEvent) => {
        const me = e as leaflet.LeafletMouseEvent; // Coersion seems to be unavoidable?
        // Deselect any selected markers        
        if (me?.originalEvent?.ctrlKey && me?.latlng) {
          MapPresenter.copyTextToClipboard(me.latlng.lat + "," + me.latlng.lng);
        }
        
        eventbus.publish({
          topic: "Directory.InitiativeClicked",
          data: ""
        });
      },
      load: (_: leaflet.LeafletEvent) => {
        console.log("Map loaded");

        let defaultOpenSidebar = this.factory.config.getDefaultOpenSidebar();

        // Trigger loading of the sidebar, the deps should all be in place now.
        this.factory.getSidebarView(this.factory).then(sidebar => {
          if (defaultOpenSidebar)
            sidebar.showSidebar()
        });

      },
      resize: (_: leaflet.LeafletEvent) => {
        this.view.map?.invalidateSize();
        console.log("Map resize", window.outerWidth);
      }
    };
  }

  onInitiativeNew(initiative: Initiative) {
    const marker = this.view.addMarker(initiative).marker as ExtendedMarker; // Coercion!

    if (marker.hasPhysicalLocation) this.factory.allMarkers.push(marker);
  }
  
  refreshInitiative(initiative: Initiative) {
    this.view.refreshMarker(initiative);
  }


  onInitiativeReset(initiative: Initiative) {

    this.view.removeAllMarkers();
    this.factory.allMarkers = [];
    this.factory.loadedInitiatives = [];
    console.log("removing all");
    //rm markers 
  }

  onInitiativeComplete() {
    // Load the markers into the clustergroup
    const bounds = this.getInitialBounds();
    if (bounds)
      this.view.fitBounds({bounds: bounds});
    this.view.unselectedClusterGroup?.addLayers(this.factory.allMarkers);
    console.log("onInitiativeComplete");
    // eventbus.publish({
    //   topic: "Markers.completed",
    //   data: { markers: this.factory.allMarkers }
    // });
    // eventbus.publish({
    //   topic: "Markers.",
    //   data: ""
    // });
  }


  onInitiativeDatasetLoaded() {
    console.log("onInitiativeDatasetLoaded");
    //console.log(data);
    //console.log(data.latLngBounds());
    // this.view.fitBounds([[-45.87859, -162.60022], [76.47861, 176.84446]]);
  }

  onInitiativeLoadComplete() {
    /* The protecting veil is now obsolete. */
    //view.clearProtectingVeil();
    // TODO - hook this up to a log?
    this.view.stopLoading();

  }
  
  onInitiativeLoadMessage(data: { message: string, error?: string }) {
    /* The protecting veil is now obsolete. */
    //view.showProtectingVeil(data.message);
    // TODO - hook this up to a log?
    this.view.startLoading(data);
  }

  onMarkersNeedToShowLatestSelection(data: { selected: Initiative[] }) {
    this.previouslySelected.forEach((e) => {
      this.view.setUnselected(e);
    });

    this.previouslySelected = data.selected;
    
    //zoom in and then select 
    data.selected.forEach((e) => {
      this.view.setSelected(e);
    });
  }

  onNeedToShowInitiativeTooltip(data: Initiative) {
    this.view.showTooltip(data);
  }
  
  onNeedToHideInitiativeTooltip(data: Initiative) {
    this.view.hideTooltip(data);
  }
  
  onMapNeedsToBeZoomedAndPanned(latLngBounds: SelectAndZoomData) {
    console.log("onMapNeedsToBeZoomedAndPanned ", latLngBounds);
    this.view.flyToBounds(latLngBounds);
    // this.view.flyTo(data);
    // this.view.setView(data);
  }

  onBoundsRequested(data: BoundsData) {
    this.view.fitBounds(data);
  }

  setZoom(zoom: number) {
    console.log("Zooming to ", zoom);
    this.view.setZoom(zoom);
  }

  getInitialBounds() {
    return this.factory.config.getInitialBounds() == undefined ?
           this.factory.dataservices.latLngBounds() : this.factory.config.getInitialBounds();
  }

  getInitialZoom() { }

  setActiveArea(data: { offset: number }) {
    this.view.setActiveArea(data);
  }

  getDisableClusteringAtZoomFromConfig() {
    return this.factory.config.getDisableClusteringAtZoom() || false;
  }



  //FILTERS
  applyFilter() {
    //if there are currently any filters 
    if (this.factory.getFiltered().length > 0) {
      //display only filtered initiatives, the rest should be hidden
      this.factory.markerView.hideMarkers(this.getInitiativesOutsideOfFilter());
      this.factory.markerView.showMarkers(this.factory.getFiltered());
    } else //if no filters available show everything
      this.removeFilters();
  }

  addFilter(data: Filter) {
    let initiatives = data.initiatives;
    let filterName = data.filterName;
    let verboseName = data.verboseName;

    //if filter already exists don't do anything
    if (Object.keys(this.factory.filtered).includes(filterName))
      return;

    //add filter
    this.factory.filtered[filterName] = initiatives;

    //add the verbose name of the filter
    this.factory.verboseNamesMap[filterName] = verboseName;

    //if this is the first filter, add items to the filteredInitiativesUIDMap
    if (Object.keys(this.factory.filtered).length <= 1) {
      this.factory.initiativesOutsideOfFilterUIDMap = Object.assign({},this.factory.dataservices.getAggregatedData().initiativesByUid);
      //add to array only new unique entries
      initiatives.forEach(initiative => {
        //rm entry from outside map
        delete this.factory.initiativesOutsideOfFilterUIDMap[initiative.uri];
        this.factory.filteredInitiativesUIDMap[initiative.uri] = initiative;
      });
    }
    /* if this is the second or more filter, remove items from the 
       filteredInitiativesUIDMap if they don't appear in the new filter's set of initiatives
     */
    else {      
      for(const initiativeUniqueId in this.factory.filteredInitiativesUIDMap){
        if(!initiatives.includes(this.factory.filteredInitiativesUIDMap[initiativeUniqueId])){
          this.factory.initiativesOutsideOfFilterUIDMap[initiativeUniqueId] = Object.assign({},this.factory.filteredInitiativesUIDMap[initiativeUniqueId]);
          delete this.factory.filteredInitiativesUIDMap[initiativeUniqueId];
        }
      }
    }

    console.log(this.factory.filteredInitiativesUIDMap);

    //apply filters
    this.applyFilter();
  }

  removeFilters() {
    //remove filters
    this.factory.filtered = {};
    this.factory.filteredInitiativesUIDMap = {};
    this.factory.initiativesOutsideOfFilterUIDMap = Object.assign({}, this.factory.dataservices.getAggregatedData().initiativesByUid);
    this.factory.verboseNamesMap = {};
    //show all markers
    this.factory.markerView.showMarkers(this.factory.loadedInitiatives);
  }

  removeFilter(data: Filter) {
    const filterName = data.filterName;
    //if filter doesn't exist don't do anything
    if (!Object.keys(this.factory.filtered).includes(filterName))
      return;

    //remove the filter
    let oldFilterVals = this.factory.filtered[filterName];
    delete this.factory.filtered[filterName];

    //if no filters left call remove all and stop
    if (Object.keys(this.factory.filtered).length <= 0) {
      this.removeFilters();
      return;
    }

    //add in the values that you are removing 
    oldFilterVals?.forEach(i => {
      this.factory.initiativesOutsideOfFilterUIDMap[i.uri] = i;
    });

    //remove filter initatitives 
    //TODO: CAN YOU OPTIMISE THIS ? (currently running at o(n) )
    Object.keys(this.factory.filtered).forEach(k => {
      this.factory.filtered[k]?.forEach(i => {
        //add in unique ones
        this.factory.filteredInitiativesUIDMap[i.uri] = i;
        //remove the ones you added
        delete this.factory.initiativesOutsideOfFilterUIDMap[i.uri];
      })
    });

    //remove filter from verbose name
    delete this.factory.verboseNamesMap[filterName];


    //apply filters
    this.applyFilter();
  }



  //should return an array of unique initiatives outside of filters
  getInitiativesOutsideOfFilter() {
    return Object.values(this.factory.initiativesOutsideOfFilterUIDMap);
  }
  //FILTERS END


  //SEARCH HIGHLIGHT


  //highlights markers, hides markers not in the current selection
  addSearchFilter(data: Filter) {
    
    //if no results remove the filter, currently commented out
    if (data.initiatives != null && data.initiatives.length == 0) {
      // uncommenting this will reveal all initiatives on a failed search
      // this.removeSearchFilter();
      // return;
      console.log("no results, hide everything");
      //hide all 
      this.factory.hidden = this.factory.loadedInitiatives;
      this.factory.markerView.hideMarkers(this.factory.hidden);
      return;
    }

    /*
       //this was causing a bug and doesn't seem to do anything useful

       //if the results match the previous results don't do anything
       if (data.initiatives == this.factory.lastRequest)
       return;

       this.factory.lastRequest = data.initiatives; //cache the last request
     */


    //get the ids from the passed data
    const initiativeIds = data.initiatives.map(i => i.uri);
    
    //hide the ones you need to  hide, i.e. difference between ALL and initiativesMap
    this.factory.hidden = this.factory.loadedInitiatives.filter(i => 
      !initiativeIds.includes(i.uri)
    );

    //hide all unneeded markers
    this.factory.markerView.hideMarkers(this.factory.hidden);
    //make sure the markers you need to highlight are shown
    this.factory.markerView.showMarkers(data.initiatives);

    //zoom and pan

    if (data.initiatives.length > 0) {
      var options: ZoomOption = {
        maxZoom: this.factory.config.getMaxZoomOnSearch()
      }
      if (options.maxZoom == 0)
        options = {};

      const latlng = this.factory.dataservices.latLngBounds(data.initiatives)
      eventbus.publish({
        topic: "Map.needsToBeZoomedAndPanned",
        data: {
          initiatives: data.initiatives,
          bounds: latlng,
          options: options
        }
      });
    }
  }

  getLogo() {
    return this.factory.config.logo();
  }

  refresh() {
    eventbus.publish({
      topic: "Map.refresh",
      data: ""
    });
  }

  selectAndZoomOnInitiative(data: SelectAndZoomData) {
    this.view.selectAndZoomOnInitiative(data);
  }

  //this can get called multiple times make sure it doesn't crash
  removeSearchFilter() {

    //if no search filter to remove just return
    if (this.factory.hidden.length === 0)
      return;

    //show hidden markers
    //this.factory.markerView.showMarkers(hidden);
    this.applyFilter();

    if (this.factory.getFiltered().length > 0) {
      //hide the initiatives that were outside of the filter
      this.factory.markerView.hideMarkers(this.getInitiativesOutsideOfFilter());// this can be sped up
      //you can speed up the above statement by replacing this.getInitiativesOutsideOfFilter() 
      //with the difference between getFiltered() and data.initiatives
      //i.e. getting the initiatives that are outside of the filter but still shown

      //show the ones inside the filter that you just hid
      this.factory.markerView.showMarkers(this.factory.hidden);
    } else //if no filters available then the search was under global (only hidden ones need to be shown)
      this.factory.markerView.showMarkers(this.factory.hidden);

    //clear last request so you can search the same data again
//    this.factory.lastRequest = [];

    //reset the hidden array
    this.factory.hidden = [];

    //zoom and pan
    //const latlng = dataservices.latLngBounds(getFiltered().length > 0? getFiltered() : null)
    // eventbus.publish({
    //   topic: "Map.needsToBeZoomedAndPanned",
    //   data: {
    //   initiatives: hidden,
    //     bounds: latlng,
    //     options: {
    //       maxZoom: config.getMaxZoomOnGroup()
    //     }
    //   }
    // });

    eventbus.publish({
      topic: "Markers.needToShowLatestSelection",
      data: {
        selected: []
      }
    });
  }
  //END SEARCH HIGHLIGHT
}
