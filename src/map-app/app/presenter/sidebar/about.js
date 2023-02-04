"use strict";
const eventbus = require('../../eventbus');
const { BaseSidebarPresenter } = require('./base');

function init(registry) {
  const config = registry('config');
  
  function Presenter() { }

  var proto = Object.create(BaseSidebarPresenter.prototype);

  Presenter.prototype = proto;

  function createPresenter(view) {
    var p = new Presenter();
    p.registerView(view);
    return p;
  }
  return {
    createPresenter: createPresenter
  };
}
module.exports = init;
