"use strict";

import { BaseView } from "./view/base";

// 'Base class' for all presenters:
export class base<V extends BaseView> {

  constructor(public view?: V) {}
  
  registerView(view: V) {
    this.view = view;
  }
}

