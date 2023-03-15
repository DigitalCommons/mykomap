import { EventBus } from '../../../eventbus';
import { DirectorySidebarView } from '../../view/sidebar/directory';
import { BaseSidebarPresenter } from './base';
import { Initiative } from '../../model/initiative';
import { SidebarPresenter } from '../sidebar';
import { SearchResults } from '../../../search-results';

export class DirectorySidebarPresenter extends BaseSidebarPresenter {
  readonly view: DirectorySidebarView;
  
  constructor(readonly parent: SidebarPresenter) {
    super(parent);
    this.view = new DirectorySidebarView(this);

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

  currentItem(): SearchResults | undefined {
    return this.parent.mapui.contentStack.current();
  }

  notifyViewToBuildDirectory(): void {
    this.view.refresh();
  }

  // Gets the initiatives with a selection key, or if absent, gets all the initiatives
  getInitiativesForFieldAndSelectionKey(title: string, key?: string): Initiative[] {
    if (key == null)
      return this.parent.mapui.dataServices.getAggregatedData().loadedInitiatives;
    else
      return this.parent.mapui.dataServices.getAggregatedData().registeredValues[title]?.[key] ?? [];
  }

  notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives: Initiative[]): void {
    if (initiatives.length <= 0)
      return;
    const data = EventBus.Map.mkSelectAndZoomData(initiatives, { maxZoom: this.parent.mapui.config.getMaxZoomOnGroup() });
    EventBus.Map.needsToBeZoomedAndPanned.pub(data);
  }

  notifyMapNeedsToNeedsToSelectInitiative(initiatives: Initiative[]): void {
    if (initiatives.length == 0)
      return;
    
    const maxZoom = initiatives.length === 1? this.parent.mapui.config.getMaxZoomOnGroup() : undefined;
    const defaultPos = this.parent.mapui.config.getDefaultLatLng();
    
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
      //this.parent.contentStack.append(new SearchResults([initiative]));
      // Move the window to the right position first
      this.notifyMapNeedsToNeedsToSelectInitiative([initiative]);

      // Populate the sidebar and hoghlight the iitiative in the directory
      this.view.populateInitiativeSidebar(
        initiative,
        this.parent.mapui.markers.getInitiativeContent(initiative) ?? ''
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
  
}
