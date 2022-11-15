// The view aspects of the Main Menu sidebar
"use strict";
const eventbus = require('../../eventbus')

function init(registry) {
  const config = registry('config');
  const sidebarView = registry('view/base');
  const presenter = registry('presenter/sidebar/mainmenu');

  // Our local Sidebar object:
  function Sidebar() {}

  // Our local Sidebar inherits from sidebar:
  var proto = Object.create(sidebarView.base.prototype);

  // And adds some overrides and new properties of it's own:
  proto.title = "Main menu";
  proto.hasHistoryNavigation = false;

  proto.populateScrollableSelection = function(selection) {
    this.presenter.getButtons().forEach(function(button) {
      selection
        .append("button")
        .attr(
          "class",
          "w3-bar-item w3-button w3-mobile" +
             (button.disabled ? " w3-disabled" : "")
        )
        .attr("title", button.hovertext)
        .on("click", button.onClick)
        .text(button.label);
    });
  };
  Sidebar.prototype = proto;

  function createSidebar() {
    var sb = new Sidebar();
    sb.setPresenter(presenter.createPresenter(sb));
    return sb;
  }
  return {
    createSidebar: createSidebar
  };
}

module.exports = init;
