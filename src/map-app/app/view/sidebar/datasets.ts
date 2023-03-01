import * as d3 from "d3";
import { DatasetsSidebarPresenter } from "../../presenter/sidebar/datasets";
import { d3Selection } from "../d3-utils";
import { BaseSidebarView } from "./base";

export class DatasetsSidebarView extends BaseSidebarView {
  // And adds some overrides and new properties of it's own:
  readonly title: string = "datasets";
  hasHistoryNavigation: boolean = false; // No forward/back buttons for this sidebar
  
  constructor(readonly presenter: DatasetsSidebarPresenter) {
    super();
  }

  populateFixedSelection(selection: d3Selection): void {
    let textContent = this.presenter.parent.mapui.labels.datasets ?? '';
    selection
      .append("div")
      .attr("class", "w3-container")
      .append("h1")
      .text(textContent);
  }


  populateScrollableSelection(selection: d3Selection) {
    const datasets = this.presenter.getDatasets();
    const defaultActive = this.presenter.getDefault();
    const defaultIdMixed = this.presenter.getMixedId();

    //create new div for buttons
    const datasetBtns = selection.append("ul")
      .attr("class", "sea-directory-list colours capitalized");

    const color_class = (i: number) => {
      return "sea-field-am" + Math.floor(((i + 1) % 12) * 10);
    }
    Object.entries(datasets).forEach(([name, dataset], i) => {
      if (!dataset) return;
      let btn = datasetBtns
        .append("li")
        .attr("class", color_class(i))
        .attr("id", dataset + "-btn")
        .attr("title", "load " + dataset.label + " dataset")
        .text(dataset.label);
      btn.on("click", () => {
        d3.select(".sea-field-active").classed("sea-field-active", false);
        btn.classed("sea-field-active", true);
        this.presenter.changeDatasets(name);
      });
    });
    //add mixed btn
    if (Object.keys(datasets).length > 1) {
      let btn = datasetBtns
        .append("li")
        .attr("class", color_class(Object.keys(datasets).length))
        .attr("id", `${defaultIdMixed}-btn`)
        .attr("title", "load mixed dataset")
        .text(this.presenter.parent.mapui.labels.mixedSources ?? '');
      btn.on("click", () => {
        d3.select(".sea-field-active").classed("sea-field-active", false);
        btn.classed("sea-field-active", true);
        this.presenter.changeDatasets(true);
      });
    }

    //set the default active button (currently loaded dataset)
    selection.select(`#${defaultActive}-btn`)
      .classed("sea-field-active", true);
  }
}
