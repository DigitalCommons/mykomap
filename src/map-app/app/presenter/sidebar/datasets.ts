import { DataLoaderMap, DataServices } from '../../model/data-services';
import { InitiativeObj } from '../../model/initiative';
import { DatasetsSidebarView } from '../../view/sidebar/datasets';
import { SidebarPresenter } from '../sidebar';
import { BaseSidebarPresenter } from './base';

export class DatasetsSidebarPresenter extends BaseSidebarPresenter {
  readonly view: DatasetsSidebarView;
  private readonly mixedId = "all";

  
  constructor(readonly parent: SidebarPresenter) {
    super(parent);
    this.view = new DatasetsSidebarView(this);
  }
  
  getDatasets(): DataLoaderMap<InitiativeObj> {
    return this.parent.mapui.dataServices.getDatasets();
  }
  
  getDefault(): string {
    let val = this.parent.mapui.dataServices.getCurrentDatasets();
    return val === true? "all" : val;
  }
  
  getMixedId(): string {
    return this.mixedId;
  }

  // Called when the user selects a dataset in the datasets sidebar panel
  //
  // @param dataset - the name of the selected dataset, or boolean `true` to select all datasets
  //
  //set default somewhere else where it loads the initiatives
  //remove initiatives from menu on the side
  //remove initiatives from map
  changeDatasets(dataset: string | true) {
    this.parent.mapui.dataServices.reset(dataset); // simply delegate
  };
}
