import { AboutSidebarView } from '../../view/sidebar/about';
import { BaseSidebarPresenter  } from './base';

export class AboutSidebarPresenter extends BaseSidebarPresenter {
  constructor(readonly view: AboutSidebarView) {
    super(view.parent.presenter);
  }
}
