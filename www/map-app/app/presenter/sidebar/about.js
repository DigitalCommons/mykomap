"use strict";
const eventbus = require('../../eventbus');


function init(registry) {
  const config = registry('config');
  const sidebarPresenter = registry('presenter/sidebar/base');
  
  function Presenter() { }

  var proto = Object.create(sidebarPresenter.base.prototype);

  proto.getSoftwareVersion = function () {
    return {
      variant: config.getSoftwareVariant(),
      timestamp: config.getSoftwareTimestamp(),
      gitcommit: config.getSoftwareGitCommit(),
      version: config.getVersionTag()
    };
  };
  proto.aboutHtml = function () {
    return config.aboutHtml();
  };

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
