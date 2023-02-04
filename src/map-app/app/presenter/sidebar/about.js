const { BaseSidebarPresenter } = require('./base');

export class AboutPresenter extends BaseSidebarPresenter {
  constructor(view) {
    super();
    this.registerView(view);
  }
}
