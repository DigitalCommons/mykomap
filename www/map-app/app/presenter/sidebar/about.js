/*define(["app/eventbus", "model/config", "presenter/sidebar/base"], function (
  eventbus,
  config,
  sidebarPresenter
) {*/
  const eventbus = require('../../eventbus');
  const config = require('../../model/config');
  const sidebarPresenter = require('./base');

  "use strict";

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
  var pub = {
    createPresenter: createPresenter
  };
  module.exports = pub;
//});
