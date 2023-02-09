// The view aspects of the datasets sidebar
"use strict";
const d3 = require('d3');
const eventbus = require('../../eventbus')
const { BaseSidebarView } = require('./base');
const { DatasetsPresenter } = require('../../presenter/sidebar/datasets');

// TODO These same consts are here and in view/sidebar/initiative.
//      Find a common place for them.
const sectionHeadingClasses =
  "w3-bar-item w3-tiny w3-light-grey w3-padding-small";
const hoverColour = " w3-hover-light-blue";
const accordionClasses =
  "w3-bar-item w3-tiny w3-light-grey w3-padding-small" + hoverColour;
const sectionClasses = "w3-bar-item w3-small w3-white w3-padding-small";


export class DatasetsSidebarView extends BaseSidebarView {

  // And adds some overrides and new properties of it's own:
  title = "datasets";
  hasHistoryNavigation = false; // No forward/back buttons for this sidebar
  
  constructor(parent, labels, dataServices) {
    super();
    this.labels = labels;
    this.parent = parent;
    this.presenter = new DatasetsPresenter(this, dataServices);
  }

  populateFixedSelection(selection) {
    let textContent = this.labels.datasets;
    selection
      .append("div")
      .attr("class", "w3-container")
      .append("h1")
      .text(textContent);
  }


  populateScrollableSelection(selection) {
    const datasets = this.presenter.getDatasets();
    const defaultActive = this.presenter.getDefault();
    const defaultIdMixed = this.presenter.getMixedId();
    const that = this;

    //create new div for buttons
    const datasetBtns = selection.append("ul")
      .attr("class", "sea-directory-list colours capitalized");

    const color_class = function (i) {
      return "sea-field-am" + Math.floor(((i + 1) % 12) * 10);
    }
    Object.keys(datasets).forEach((dataset, i) => {
      let btn = datasetBtns
        .append("li")
        .attr("class", color_class(i))
        .attr("id", dataset + "-btn")
        .attr("title", "load " + datasets[dataset].label + " dataset")
        .text(datasets[dataset].label);
      btn.on("click", () => {
        d3.select(".sea-field-active").classed("sea-field-active", false);
        btn.classed("sea-field-active", true);
        that.presenter.changeDatasets(dataset);
      });
    });
    //add mixed btn
    if (Object.keys(datasets).length > 1) {
      let btn = datasetBtns
        .append("li")
        .attr("class", color_class(Object.keys(datasets).length))
        .attr("id", `${defaultIdMixed}-btn`)
        .attr("title", "load mixed dataset")
        .text(this.labels.mixedSources);
      btn.on("click", () => {
        d3.select(".sea-field-active").classed("sea-field-active", false);
        btn.classed("sea-field-active", true);
        that.presenter.changeDatasets(true);
      });
    }

    //set the default active button (currently loaded dataset)
    selection.select(`#${defaultActive}-btn`)
      .classed("sea-field-active", true);
  }
}
