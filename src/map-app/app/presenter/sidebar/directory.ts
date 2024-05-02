import { EventBus } from '../../../eventbus';
import { DirectorySidebarView } from '../../view/sidebar/directory';
import { BaseSidebarPresenter } from './base';
import { SidebarPresenter } from '../sidebar';

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
  }

  // This gets the localised 'allEntries' label in all cases.
  //
  // It used to facilitate a hack as per issue #177. Leaving here as a
  // stub in case we want to localise this case in some case-specific
  // way in the future.
  getAllEntriesLabel(propName: string): string {
    return this.parent.mapui.labels.allEntries;
  }
}
