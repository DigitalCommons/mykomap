"use strict";

// 'Base class' for all presenters:
export class base {
  view = undefined;
  registerView(v) {
    this.view = v;
  }
}

