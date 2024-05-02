// The view aspects of the Main Menu sidebar
import * as d3 from "d3";
import { Dictionary } from "../../../common-types";
import { EventBus } from "../../../eventbus";
import { Initiative } from "../../model/initiative";
import { DirectorySidebarPresenter } from "../../presenter/sidebar/directory";
import { d3Selection } from "../d3-utils";
import { BaseSidebarView } from "./base";
import { propDefToVocabUri } from "../../model/data-services";

function uriToTag(uri: string) {
  return uri.toLowerCase().replace(/^.*[:\/]/, "");
}
function labelToTag(uri: string) {
  return uri.toLowerCase().replace(/ /g, "-");
}


export class DirectorySidebarView extends BaseSidebarView {
  
  hasHistoryNavigation: boolean = false;
  dissapear?: number;
  readonly title: string;

  constructor(readonly presenter: DirectorySidebarPresenter) {
    super();
    this.title = presenter.parent.mapui.labels.directory;
  }

  refresh(changed: boolean) {
    this.loadHistoryNavigation();
    if (changed) {
      // only need to load these if we changed to the directory sidebar
      this.loadFixedSection();
      this.loadScrollableSection();
    }
    this.refreshSearchResults();
  }


  populateFixedSelection(selection: d3Selection): void {
    const that = this;
    let sidebarTitle = this.title;
    const container = selection
      .append("div");

    container.append("h1")
      .text(sidebarTitle)
      .attr("id", "dir-title");

    container.append("input")
      .attr("id", "dir-filter")
      //.classed("w3-center",true)
      .attr("type", "text")
      .on("keyup", function () {
        that.handleFilter(this.value);
      });
  }


  resetFilterSearch(): void {
    const elem = document.getElementById("dir-filter");
    if (elem instanceof HTMLInputElement) {
      elem.value = '';
      this.handleFilter('');
    }
  }

  handleFilter(input: string) {
    if (this.dissapear) {
      clearTimeout(this.dissapear);
      this.dissapear = undefined;
    }

    if (!input || input == null)
      d3.selectAll("li.sea-directory-field").attr("hidden", null);
    else {
      const a = d3.selectAll("li.sea-directory-field");
      a.attr("hidden", true); // Hide everything
      a.filter(function () {
        // Unhide elements which have matching text
        return d3.select(this).text().toLowerCase().includes(input);
      }).attr("hidden", null);
      //appear and set dissapear after seconds 
      //cancel last dissapear if new one is coming in
      d3.select("#dir-filter")
        .style("width", "auto")
        .style("opacity", "100");

      const dissapear = () => {
        d3.select("#dir-filter")
          .transition()
          .duration(400)
          .style("opacity", "0").transition().style("width", "0px");
      };

      // dissapear in 1 sec
      this.dissapear = window.setTimeout(dissapear, 1000);
    }
  }

  populateScrollableSelection(selection: d3Selection) {
    const vocabs = this.presenter.parent.mapui.dataServices.getVocabs();
    const props = this.presenter.parent.mapui.config.fields();
    const lang = this.presenter.parent.mapui.config.getLanguage();
    let list = selection
      .append("ul")
      .classed("sea-directory-list", true)
      .classed("colours", this.presenter.parent.mapui.config.doesDirectoryHaveColours());

    // key may be null, for the special 'Every item' case
    const addItem = (propName: string, propValue?: string)  => {
      let label = propValue; // default case
      let classname = 'sea-field-all-entries'; // default case

      if (propValue === undefined) {
        // The "all" case
        // classname remains at default
        label = this.presenter.getAllEntriesLabel(propName);
      }
      else {
        const propDef = props[propName];
        const propUri = propDefToVocabUri(propDef);
        
        if (vocabs !== undefined && propUri) {
          // This is a vocab field
          label = vocabs.getTerm(propValue, lang);
          classname = `sea-field-${uriToTag(propValue)}`;          
        }
        else {
          // The value comes from the data directly
          // label stays at default.
          classname = `sea-field-${labelToTag(propValue)}`;
        }
      }

      list
        .append("li")
        .text(label ?? '')
        .classed(classname, true)
        .classed("sea-directory-field", true)
        .on("click", (event: MouseEvent) => {
          this.presenter.parent.mapui.resetSearch();
          this.presenter.parent.mapui.changeFilters(propName, propValue);
          EventBus.Sidebar.showInitiativeList.pub();
          this.resetFilterSearch();
          d3.select(".sea-field-active").classed("sea-field-active", false);
          if (event.currentTarget instanceof Element)
            d3.select(event.currentTarget).classed("sea-field-active", true);
        });
    }

    function addItems(propName: string, values: Dictionary<Initiative[]>) {
      Object.keys(values)
      // Any sorting should have been done as the initiatives were loaded
        .forEach(key => addItem(propName, key));
    }

    const mapui = this.presenter.parent.mapui;
    const registeredValues = mapui.dataServices.getAggregatedData().registeredValues;
    const filterableFields = mapui.config.getFilteredPropDefs();
    const directoryPropName: string|undefined = Object.keys(filterableFields)[0];
    if (directoryPropName === undefined)
      throw new Error(`there are no filtered fields - so no directory can be rendered. Shouldn't happen!`);
      
    // Just run on the first property for now
    // TODO: Support user selectable fields
    
    // Deal with the special 'All' item first
    addItem(directoryPropName);

    const values = registeredValues[directoryPropName]
    if (values)
      addItems(directoryPropName, values);
  }
}
