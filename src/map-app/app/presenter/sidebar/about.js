import {  BaseSidebarPresenter  } from './base';

export class AboutPresenter extends BaseSidebarPresenter {
  constructor(view) {
    super();
    this.parent = view.parent.presenter;
    this.registerView(view);
  }
}
