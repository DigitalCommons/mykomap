import { Box2d, Dictionary } from '../../../common_types';
import { StackItem } from '../../../stack';
import { EventBus } from '../../../eventbus';
import { Config } from '../../model/config';
import { DataServices } from '../../model/dataservices';
import { MarkerViewFactory } from '../../view/map/marker';
import { DirectorySidebarView } from '../../view/sidebar/directory';
import { BaseSidebarPresenter } from './base';
import { Initiative } from '../../model/initiative';

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
    if (initiatives.length <= 0)
      return;
    const data = EventBus.Map.mkSelectAndZoomData(initiatives, { maxZoom: this.config.getMaxZoomOnGroup() });
    EventBus.Map.needsToBeZoomedAndPanned.pub(data);
  }


  notifyMapNeedsToNeedsToSelectInitiative(initiatives: Initiative[]): void {
    if (initiatives.length == 0)
      return;
    
    const maxZoom = initiatives.length === 1? this.config.getMaxZoomOnGroup() : undefined;
    const defaultPos = this.config.getDefaultLatLng();
    
    const data = EventBus.Map.mkSelectAndZoomData(initiatives, { maxZoom, defaultPos });
    EventBus.Map.selectAndZoomOnInitiative.pub(data);
  }

  onInitiativeMouseoverInSidebar(initiative: Initiative): void {
    EventBus.Map.needToShowInitiativeTooltip.pub(initiative);
  }
  onInitiativeMouseoutInSidebar(initiative: Initiative): void {
    EventBus.Map.needToHideInitiativeTooltip.pub(initiative);
  }

  clearLatestSelection() {
    EventBus.Markers.needToShowLatestSelection.pub([]);
  }

  removeFilters(filterName?: string) {
    //remove specific filter
    if (filterName) {
      EventBus.Map.removeFilter.pub(filterName);
    }
    else {
      //remove all filters
      EventBus.Map.removeFilters.pub();
    }
    this.view.d3selectAndClear(
      "#sea-initiatives-list-sidebar-content"
    );
    //clear the window
    EventBus.Sidebar.hideInitiativeList.pub();
    this.clearLatestSelection();
  }

  initiativeClicked(initiative?: Initiative): void {
    if (initiative) {
      //this.parent.contentStack.append(new StackItem([initiative]));
      // Move the window to the right position first
      this.notifyMapNeedsToNeedsToSelectInitiative([initiative]);

      // Populate the sidebar and hoghlight the iitiative in the directory
      this.view.populateInitiativeSidebar(
        initiative,
        this.markerView.getInitiativeContent(initiative) ?? ''
      );

    }
    else {
      // User has deselected
      // TODO: This probably shouldn\t be here
      EventBus.Markers.needToShowLatestSelection.pub([]);
      // Deselect the sidebar and hoghlight the iitiative in the directory
      this.view.deselectInitiativeSidebar();

      //doesn't do much?
    }
  }

  latLngBounds(initiatives: Initiative[]): Box2d  {
    return this.dataServices.latLngBounds(initiatives);
  }

  _eventbusRegiter() {
    EventBus.Initiatives.reset.sub(() => {
      // User has deselected
      // TODO: This probably shouldn\t be here
      EventBus.Markers.needToShowLatestSelection.pub([]);
      //todo reload new ones inside instead (without closing)
      EventBus.Sidebar.hideInitiativeList.pub();
    });
    EventBus.Directory.initiativeClicked.sub(initiative => this.initiativeClicked(initiative));
    EventBus.Directory.removeFilters.sub(filters => this.removeFilters(filters));
  }
  
}
