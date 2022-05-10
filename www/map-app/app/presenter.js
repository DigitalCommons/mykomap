"use strict";

// 'Base class' for all presenters:
export class base {
  view = null;
  registerView(v) {
    this.view = v;
  }
}
