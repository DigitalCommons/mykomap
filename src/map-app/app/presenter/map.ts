import { BasePresenter } from './base';
import * as d3 from 'd3';
import { EventBus } from '../../eventbus';
import * as leaflet from 'leaflet';
import { Dictionary } from '../../common-types';
import { MapView } from '../view/map';
import { Initiative } from '../model/initiative';
import { toString as _toString } from '../../utils';
import { MapUI } from '../map-ui';

export class MapPresenter extends BasePresenter {
  readonly view: MapView;
  previouslySelected: Initiative[] = [];
  
  constructor(readonly mapUI: MapUI) {
    super();
    this.view = new MapView(this);
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
    return this.mapUI.config.getTileUrl();
  }
  
  getMapAttribution() {
    return this.mapUI.config.getMapAttribution();
  }
  
  getMapEventHandlers(): Dictionary<leaflet.LeafletEventHandlerFn> {
    return {
      click: (e: leaflet.LeafletEvent) => {
        const me = e as leaflet.LeafletMouseEvent; // Coersion seems to be unavoidable?
        // Deselect any selected markers        
        if (me?.originalEvent?.ctrlKey && me?.latlng) {
          MapPresenter.copyTextToClipboard(me.latlng.lat + "," + me.latlng.lng);
        }

        EventBus.Directory.initiativeClicked.pub(undefined);
      },
      load: (_: leaflet.LeafletEvent) => {
        console.log("Map loaded");

        let defaultOpenSidebar = this.mapUI.config.getDefaultOpenSidebar();

        // Trigger loading of the sidebar, the deps should all be in place now.
        this.mapUI.getSidebarPresenter(this.mapUI).then(sidebar => {
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
    this.view.addMarker(initiative);
  }
  
  refreshInitiative(initiative: Initiative) {
    this.view.refreshMarker(initiative);
  }


  onInitiativeReset() {

    this.view.removeAllMarkers();
    this.mapUI.loadedInitiatives = [];
    console.log("removing all");
    //rm markers 
  }

  onInitiativeComplete() {
    // Load the markers into the clustergroup
    const bounds = this.getInitialBounds();
    if (bounds)
      this.view.fitBounds({bounds: bounds});
    this.view.unselectedClusterGroup?.addLayers(this.mapUI.markers.withPhysicalLocation());
    console.log("onInitiativeComplete");
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
  
  onInitiativeLoadMessage(error?: EventBus.Initiatives.DatasetError) {
    this.view.startLoading(error);
  }

  onMarkersNeedToShowLatestSelection(selected: Initiative[]) {
    this.previouslySelected.forEach((e) => {
      this.view.setUnselected(e);
    });

    this.previouslySelected = selected;
    
    //zoom in and then select 
    selected.forEach((e) => {
      this.view.setSelected(e);
    });
  }

  onNeedToShowInitiativeTooltip(data: Initiative) {
    this.view.showTooltip(data);
  }
  
  onNeedToHideInitiativeTooltip(data: Initiative) {
    this.view.hideTooltip(data);
  }
  
  onMapNeedsToBeZoomedAndPanned(latLngBounds: EventBus.Map.SelectAndZoomData) {
    console.log("onMapNeedsToBeZoomedAndPanned ", latLngBounds);
    this.view.flyToBounds(latLngBounds);
    // this.view.flyTo(data);
    // this.view.setView(data);
  }

  onBoundsRequested(data: EventBus.Map.BoundsData) {
    this.view.fitBounds(data);
  }

  setZoom(zoom: number) {
    console.log("Zooming to ", zoom);
    this.view.setZoom(zoom);
  }

  getInitialBounds() {
    return this.mapUI.config.getInitialBounds() == undefined ?
           this.mapUI.dataServices.latLngBounds() : this.mapUI.config.getInitialBounds();
  }

  getInitialZoom() { }

  setActiveArea(offset: number) {
    this.view.setActiveArea(offset);
  }

  getDisableClusteringAtZoomFromConfig() {
    return this.mapUI.config.getDisableClusteringAtZoom() || false;
  }



  //FILTERS
  applyFilter() {
    //if there are currently any filters 
    if (this.mapUI.getFiltered().length > 0) {
      //display only filtered initiatives, the rest should be hidden
      this.mapUI.markers.hideMarkers(this.getInitiativesOutsideOfFilter());
      this.mapUI.markers.showMarkers(this.mapUI.getFiltered());
    } else //if no filters available show everything
      this.removeFilters();
  }

  addFilter(data: EventBus.Map.Filter) {
    let initiatives = data.initiatives;
    let filterName = data.filterName;
    let verboseName = data.verboseName;

    if (filterName === undefined)
      return;
    
    //if filter already exists don't do anything
    if (Object.keys(this.mapUI.filtered).includes(filterName))
      return;

    //add filter
    this.mapUI.filtered[filterName] = initiatives;

    //add the verbose name of the filter
    this.mapUI.verboseNamesMap[filterName] = verboseName;

    //if this is the first filter, add items to the filteredInitiativesUIDMap
    if (Object.keys(this.mapUI.filtered).length <= 1) {
      this.mapUI.initiativesOutsideOfFilterUIDMap = Object.assign({},this.mapUI.dataServices.getAggregatedData().initiativesByUid);
      //add to array only new unique entries
      initiatives.forEach(initiative => {
        //rm entry from outside map
        const uri = _toString(initiative.uri, null);
        if (uri === null) {
          console.warn("initiative has non-string uri property, ignoring", initiative);
        }
        else {
          delete this.mapUI.initiativesOutsideOfFilterUIDMap[uri];
          this.mapUI.filteredInitiativesUIDMap[uri] = initiative;
        }
      });
    }
    /* if this is the second or more filter, remove items from the 
       filteredInitiativesUIDMap if they don't appear in the new filter's set of initiatives
     */
    else {      
      for(const initiativeUniqueId in this.mapUI.filteredInitiativesUIDMap){
        const initiative = this.mapUI.filteredInitiativesUIDMap[initiativeUniqueId];
        if(initiative && !initiatives.includes(initiative)){
          this.mapUI.initiativesOutsideOfFilterUIDMap[initiativeUniqueId] = Object.assign({},this.mapUI.filteredInitiativesUIDMap[initiativeUniqueId]);
          delete this.mapUI.filteredInitiativesUIDMap[initiativeUniqueId];
        }
      }
    }

    console.log(this.mapUI.filteredInitiativesUIDMap);

    //apply filters
    this.applyFilter();
  }

  removeFilters() {
    //remove filters
    this.mapUI.filtered = {};
    this.mapUI.filteredInitiativesUIDMap = {};
    this.mapUI.initiativesOutsideOfFilterUIDMap = Object.assign({}, this.mapUI.dataServices.getAggregatedData().initiativesByUid);
    this.mapUI.verboseNamesMap = {};
    //show all markers
    this.mapUI.markers.showMarkers(this.mapUI.loadedInitiatives);
  }

  removeFilter(filterName: string) {
    //if filter doesn't exist don't do anything
    if (!Object.keys(this.mapUI.filtered).includes(filterName))
      return;

    //remove the filter
    let oldFilterVals = this.mapUI.filtered[filterName];
    delete this.mapUI.filtered[filterName];

    //if no filters left call remove all and stop
    if (Object.keys(this.mapUI.filtered).length <= 0) {
      this.removeFilters();
      return;
    }

    //add in the values that you are removing 
    oldFilterVals?.forEach(i => {
      const uri = _toString(i.uri, null);
      if (uri !== null)
        this.mapUI.initiativesOutsideOfFilterUIDMap[uri] = i;
      else
        console.warn("inititive has non-string uri property, ignoring", i);
    });

    //remove filter initatitives 
    //TODO: CAN YOU OPTIMISE THIS ? (currently running at o(n) )
    Object.keys(this.mapUI.filtered).forEach(k => {
      this.mapUI.filtered[k]?.forEach(i => {
        const uri = _toString(i.uri, null);
        if (uri !== null) {
          //add in unique ones
          this.mapUI.filteredInitiativesUIDMap[uri] = i;
          //remove the ones you added
          delete this.mapUI.initiativesOutsideOfFilterUIDMap[uri];
        }
        else
          console.warn("inititive has non-string uri property, ignoring", i);
      })
    });

    //remove filter from verbose name
    delete this.mapUI.verboseNamesMap[filterName];


    //apply filters
    this.applyFilter();
  }



  //should return an array of unique initiatives outside of filters
  getInitiativesOutsideOfFilter(): Initiative[] {
    return Object.values(this.mapUI.initiativesOutsideOfFilterUIDMap)
      .filter((i): i is Initiative => i !== undefined);
  }
  //FILTERS END


  //SEARCH HIGHLIGHT


  //highlights markers, hides markers not in the current selection
  addSearchFilter(data: EventBus.Map.Filter) {
    
    //if no results remove the filter, currently commented out
    if (data.initiatives != null && data.initiatives.length == 0) {
      // uncommenting this will reveal all initiatives on a failed search
      // this.removeSearchFilter();
      // return;
      console.log("no results, hide everything");
      //hide all 
      this.mapUI.hidden = this.mapUI.loadedInitiatives;
      this.mapUI.markers.hideMarkers(this.mapUI.hidden);
      return;
    }

    /*
       //this was causing a bug and doesn't seem to do anything useful

       //if the results match the previous results don't do anything
       if (data.initiatives == this.mapUI.lastRequest)
       return;

       this.mapUI.lastRequest = data.initiatives; //cache the last request
     */


    //get the ids from the passed data
    const initiativeIds = data.initiatives.map(i => i.uri);
    
    //hide the ones you need to  hide, i.e. difference between ALL and initiativesMap
    this.mapUI.hidden = this.mapUI.loadedInitiatives.filter(i => 
      !initiativeIds.includes(i.uri)
    );

    //hide all unneeded markers
    this.mapUI.markers.hideMarkers(this.mapUI.hidden);
    //make sure the markers you need to highlight are shown
    this.mapUI.markers.showMarkers(data.initiatives);

    //zoom and pan

    if (data.initiatives.length > 0) {
      var options: EventBus.Map.ZoomOptions = {
        maxZoom: this.mapUI.config.getMaxZoomOnSearch()
      }
      if (options.maxZoom == 0)
        options = {};

      const latlng = this.mapUI.dataServices.latLngBounds(data.initiatives)
      EventBus.Map.needsToBeZoomedAndPanned.pub({
          initiatives: data.initiatives,
          bounds: latlng,
          options: options
      });
    }
  }

  getLogo() {
    return this.mapUI.config.logo();
  }

  selectAndZoomOnInitiative(data: EventBus.Map.SelectAndZoomData) {
    this.view.selectAndZoomOnInitiative(data);
  }

  //this can get called multiple times make sure it doesn't crash
  removeSearchFilter() {

    //if no search filter to remove just return
    if (this.mapUI.hidden.length === 0)
      return;

    //show hidden markers
    //this.mapUI.markers.showMarkers(hidden);
    this.applyFilter();

    if (this.mapUI.getFiltered().length > 0) {
      //hide the initiatives that were outside of the filter
      this.mapUI.markers.hideMarkers(this.getInitiativesOutsideOfFilter());// this can be sped up
      //you can speed up the above statement by replacing this.getInitiativesOutsideOfFilter() 
      //with the difference between getFiltered() and data.initiatives
      //i.e. getting the initiatives that are outside of the filter but still shown

      //show the ones inside the filter that you just hid
      this.mapUI.markers.showMarkers(this.mapUI.hidden);
    } else //if no filters available then the search was under global (only hidden ones need to be shown)
      this.mapUI.markers.showMarkers(this.mapUI.hidden);

    //reset the hidden array
    this.mapUI.hidden = [];

    EventBus.Markers.needToShowLatestSelection.pub([]);
  }
  //END SEARCH HIGHLIGHT
}
