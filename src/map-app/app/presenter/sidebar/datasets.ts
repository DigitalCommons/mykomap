import { DataLoaderMap, DataServices, InitiativeObj } from '../../model/dataservices';
import { DatasetsSidebarView } from '../../view/sidebar/datasets';
import { BaseSidebarPresenter } from './base';

export class DatasetsSidebarPresenter extends BaseSidebarPresenter {
  mixedId = "all";

  
  constructor(readonly view: DatasetsSidebarView, readonly dataServices: DataServices) {
    super(view.parent.presenter);
  }
  
  getDatasets(): DataLoaderMap<InitiativeObj> {
    return this.dataServices.getDatasets();
  }
  
  getDefault(): string {
    let val = this.dataServices.getCurrentDatasets();
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
    this.dataServices.reset(dataset); // simply delegate
  };
}
