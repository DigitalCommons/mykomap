/*define(["app/eventbus", "model/config", "presenter/sidebar/base"], function (
  eventbus,
  config,
  sidebarPresenter
) {*/
  const eventbus = require('../../eventbus');

  "use strict";

function init(config) {
  const sidebarPresenter = require('./base')(config);
  
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
//});
