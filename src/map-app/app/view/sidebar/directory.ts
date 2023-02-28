// The view aspects of the Main Menu sidebar
import * as d3 from "d3";
import { Dictionary } from "../../../common_types";
import { EventBus } from "../../../eventbus";
import { Initiative } from "../../model/initiative";
import { DirectorySidebarPresenter } from "../../presenter/sidebar/directory";
import { d3Selection } from "../d3-utils";
import { BaseSidebarView } from "./base";
import { toString as _toString } from "../../../utils";

function uriToTag(uri: string) {
  return uri.toLowerCase().replace(/^.*[:\/]/, "");
}
function labelToTag(uri: string) {
  return uri.toLowerCase().replace(/ /g, "-");
}


export class DirectorySidebarView extends BaseSidebarView {
  
  hasHistoryNavigation: boolean = false;
  dissapear?: number;

  constructor(readonly presenter: DirectorySidebarPresenter) {
    super();
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
      a.attr("hidden", null); // Hide everything
      a.filter(function () {
        // Unhide elements which have matching text
        return d3.select(this).text().toLowerCase().includes(input);
      }).attr("hidden", true);
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
    let list = selection
      .append("ul")
      .classed("sea-directory-list", true)
      .classed("colours", this.presenter.parent.mapui.config.doesDirectoryHaveColours());

    // key may be null, for the special 'Every item' case
    const addItem = (field: string, key?: string)  => {
      let valuesByName = this.presenter.parent.mapui.dataServices.getVerboseValuesForFields()[field];
      let label = key;
      let tag = key;

      const fieldIsCountries =
        (field: string) =>
        field == "Countries" ||
        field == "Des Pays" ||
        field == "Países" ||
        field == "국가" // FIXME this should not be hardwired!

      if (key == null) {
        tag = 'all-entries';
        label = fieldIsCountries(field) ? this.presenter.parent.mapui.labels.allCountries : this.presenter.parent.mapui.labels.allEntries;
      }
      else {
        tag = uriToTag(key);
        if (valuesByName)
          label = valuesByName[key];
      }

      list
        .append("li")
        .text(label ?? '')
        .classed("sea-field-" + tag, true)
        .classed("sea-directory-field", true)
        .on("click", (event) => {
          EventBus.Map.removeFilters.pub();
          this.listInitiativesForSelection(field, key); // key may be null
          this.resetFilterSearch();
          d3.select(".sea-field-active").classed("sea-field-active", false);
          d3.select(event.currentTarget).classed("sea-field-active", true);
        });
    }

    function addItems(field: string, values: Dictionary<Initiative[]>) {
      Object.keys(values)
      // Any sorting should have been done as the initiatives were loaded
        .forEach(key => addItem(field, key));
    }

    const registeredValues = this.presenter.parent.mapui.dataServices.getAggregatedData().registeredValues;
    // Just run om the first property for now
    // TODO: Support user selectable fields
    for (let field in registeredValues) {
      // Deal with the special 'All' item first
      addItem(field);

      const values = registeredValues[field]
      if (values)
        addItems(field, values);
      break;
    }
  }


  // selectionKey may be null, for the special 'Every item' case
  listInitiativesForSelection(directoryField: string, selectionKey?: string) {
    const labels = this.presenter.parent.mapui.labels;
    const initiatives = this.presenter.getInitiativesForFieldAndSelectionKey(
      directoryField,
      selectionKey
    );

    const fieldIsCountries =
      (field: string) =>
      field == "Countries" ||
      field == "Des Pays" ||
      field == "Países" ||
      field == "국가" // FIXME this should not be hardwired

    let selectionLabel = selectionKey;
    if (selectionLabel == null) {
      if (fieldIsCountries(directoryField))
        selectionLabel = this.presenter.parent.mapui.labels?.allCountries ?? '';
      else
        selectionLabel = this.presenter.parent.mapui.labels?.allEntries ?? '';
    }

    //deselect all
    this.presenter.clearLatestSelection();

    this.presenter.notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives);

    const sidebar = d3.select("#map-app-sidebar");
    const sidebarButton = d3.select("#map-app-sidebar-button");
    d3.select(".w3-btn").attr("title", labels?.hideDirectory ?? '');
    const initiativeListSidebar = d3.select("#sea-initiatives-list-sidebar");
    const selection = this.d3selectAndClear("#sea-initiatives-list-sidebar-content");
    const values = this.presenter.parent.mapui.dataServices.getVerboseValuesForFields()[directoryField];
    
    if (!initiativeListSidebar.empty() && !sidebarButton.empty()) {
      initiativeListSidebar.insert(() => sidebarButton.node(),
                                   "#sea-initiatives-list-sidebar-content");
      const seaFieldClasses = initiativeListSidebar.attr("class")
        .split(/\s+/).filter(c => c.match(/^sea-field-/));
      initiativeListSidebar.classed(seaFieldClasses.join(' '), false);
      initiativeListSidebar.classed(`sea-field-${labelToTag(selectionLabel)}`, true);
    }
    // Add the heading (we need to determine the title as this may be stored in the data or
    // in the list of values in the presenter)
    let title;
    if (values) {
      // If values exists and there's nothing in it for this selectionLabel then we're looking at All
      title = values[selectionLabel] || selectionLabel;
    } else {
      // If values doesn't exist then the values are coming from the data directly
      title = selectionLabel;
    }

    EventBus.Map.addFilter.pub({
      initiatives: initiatives,
      filterName: selectionKey ?? '',
      verboseName: (directoryField + ": " + title)
    });

    //setup sidebar buttons in initiative list
    const sidebarBtnHolder = selection.append("div").attr("class", "initiative-list-sidebar-btn-wrapper");


    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0 initiative-list-sidebar-btn")
      .attr("title", labels?.showSearch ?? '')
      .on("click", function () {

        EventBus.Sidebar.hideInitiativeList.pub();
        EventBus.Markers.needToShowLatestSelection.pub([]);
        EventBus.Initiatives.showSearchHistory.pub();
        EventBus.Sidebar.showInitiatives.pub();
      })
      .append("i")
      .attr("class", "fa fa-search");



    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", labels?.showInfo ?? '')
      .on("click", function () {
        EventBus.Sidebar.hideInitiativeList.pub();
        EventBus.Markers.needToShowLatestSelection.pub([]);
        EventBus.Sidebar.showAbout.pub();
      })
      .append("i")
      .attr("class", "fa fa-info-circle");



    if (true) {
      sidebarBtnHolder
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", labels?.showDatasets ?? '')
        .on("click", function () {
          EventBus.Sidebar.hideInitiativeList.pub();
          EventBus.Markers.needToShowLatestSelection.pub([]);
          EventBus.Sidebar.showDatasets.pub();
        })
        .append("i")
        .attr("class", "fa fa-database");
    }



    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button")
      .attr("title", labels.close + title)
      .on("click", () => {
        this.presenter.removeFilters(directoryField + selectionKey);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");



    selection
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button sidebar-normal-size-close-btn")
      .attr("title", labels.close + title)
      .on("click", () => {
        this.presenter.removeFilters(directoryField + selectionKey);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");

    selection
      .append("h2")
      .classed("sea-field", true)
      .text(title)
      .on("click", () => {
        this.presenter.notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives);
      });
    const list = selection.append("ul").classed("sea-initiative-list", true);
    for (let initiative of initiatives) {
      let activeClass = "";
      let nongeoClass = "";
      if (
        this.presenter.parent.contentStack.current()?.initiatives[0] === initiative
      ) {
        activeClass = "sea-initiative-active";
      }

      if (!initiative.hasLocation()) {
        nongeoClass = "sea-initiative-non-geo";
      }

      list
        .append("li")
        .text(_toString(initiative.name))
        .attr("data-uid", _toString(initiative.uri))
        .classed(activeClass, true)
        .classed(nongeoClass, true)
        .on("click", function () {
          EventBus.Directory.initiativeClicked.pub(initiative);
        })
        .on("mouseover", () => {
          this.presenter.onInitiativeMouseoverInSidebar(initiative);
        })
        .on("mouseout", () => {
          this.presenter.onInitiativeMouseoutInSidebar(initiative);
        });


    }
    sidebar
      .on(
        "transitionend",
        (event: TransitionEvent) => {
          const target = event.target as HTMLElement | null | undefined; // Need some coercion here
          if (target?.className === "w3-btn")
            return;
          if (event.propertyName === "transform")
            this.presenter.parent.view.updateSidebarWidth();
        },
        false
      )
      .classed("sea-sidebar-list-initiatives", true);
  }

  populateInitiativeSidebar(initiative: Initiative, initiativeContent: string) {
    // Highlight the correct initiative in the directory
    d3.select(".sea-initiative-active").classed("sea-initiative-active", false);
    d3.select('[data-uid="' + initiative.uri + '"]').classed(
      "sea-initiative-active",
      true
    );
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");
    let initiativeContentElement = this.d3selectAndClear(
      "#sea-initiative-sidebar-content"
    );
    initiativeContentElement
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button")
      .attr("title", `${this.presenter.parent.mapui.labels?.close ?? ''} ${initiative.name}`)
      .on("click", function () {
        EventBus.Directory.initiativeClicked.pub(undefined);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");
    initiativeContentElement
      .append("div")
      .html(initiativeContent);
    initiativeSidebar.classed("sea-initiative-sidebar-open", true);
    // if (document.getElementById("map-app-leaflet-map").clientWidth < 800)
    if (window.outerWidth < 800)
      EventBus.Sidebar.showSidebar.pub();
  }

  deselectInitiativeSidebar() {
    d3.select(".sea-initiative-active").classed("sea-initiative-active", false);
    let initiativeSidebar = d3.select("#sea-initiative-sidebar");
    // let initiativeContentElement = d3.select("#sea-initiative-sidebar-content");
    // initiativeContentElement.html(initiativeContent);
    initiativeSidebar.classed("sea-initiative-sidebar-open", false);
    d3.select(".sea-search-initiative-active")
      .classed("sea-search-initiative-active", false);
  }
  
}
