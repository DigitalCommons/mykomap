import { AboutSidebarView } from '../../view/sidebar/about';
import { SidebarPresenter } from '../sidebar';
import { BaseSidebarPresenter  } from './base';

export class AboutSidebarPresenter extends BaseSidebarPresenter {
  readonly view: AboutSidebarView;
  
  constructor(readonly parent: SidebarPresenter) {
    super(parent);
    this.view = new AboutSidebarView(this);
  }
}
