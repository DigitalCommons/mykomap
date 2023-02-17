// The view aspects of the Main Menu sidebar
import * as d3 from "d3";
import { Dictionary } from "../../../common_types";
import * as eventbus from "../../eventbus";
import { Config } from "../../model/config";
import { DataServices, Initiative, Filter } from "../../model/dataservices";
import { DirectorySidebarPresenter } from "../../presenter/sidebar/directory";
import { d3Selection } from "../d3-utils";
import { MarkerViewFactory } from "../map/marker";
import { SidebarView } from "../sidebar";
import { BaseSidebarView } from "./base";

function uriToTag(uri: string) {
  return uri.toLowerCase().replace(/^.*[:\/]/, "");
}
function labelToTag(uri: string) {
  return uri.toLowerCase().replace(/ /g, "-");
}


export class DirectorySidebarView extends BaseSidebarView {
  readonly presenter: DirectorySidebarPresenter;
  
  hasHistoryNavigation: boolean = false;
  dissapear?: number;

  constructor(readonly parent: SidebarView, readonly labels: Dictionary, readonly config: Config, readonly dataServices: DataServices, readonly markerView: MarkerViewFactory) {
    super();
    this.presenter = new DirectorySidebarPresenter(this, config, dataServices, markerView);
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
      .classed("colours", this.presenter.doesDirectoryHaveColours());

    // key may be null, for the special 'Every item' case
    const addItem = (field: string, key?: string)  => {
      let valuesByName = this.presenter.getVerboseValuesForFields()[field];
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
        label = fieldIsCountries(field) ? this.labels.allCountries : this.labels.allEntries;
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
          eventbus.publish({
            topic: "Map.removeFilters",
            data: {}
          });
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

    const registeredValues = this.presenter.getRegisteredValues();
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
    let that = this;
    let initiatives = this.presenter.getInitiativesForFieldAndSelectionKey(
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
        selectionLabel = this.labels?.allCountries ?? '';
      else
        selectionLabel = this.labels?.allEntries ?? '';
    }

    //deselect all
    that.presenter.clearLatestSelection();

    // if (window.outerWidth <= 800) {
    //   eventbus.publish({
    //     topic: "Directory.InitiativeClickedSidebar.hideSidebar"
    //   });
    // }

    that.presenter.notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives);

    const sidebar = d3.select("#map-app-sidebar");
    const sidebarButton = d3.select("#map-app-sidebar-button");
    d3.select(".w3-btn").attr("title", this.labels?.hideDirectory ?? '');
    const initiativeListSidebar = d3.select("#sea-initiatives-list-sidebar");
    const selection = this.d3selectAndClear("#sea-initiatives-list-sidebar-content");
    const values = this.presenter.getVerboseValuesForFields()[directoryField];
    
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

    const data: Filter = {
      initiatives: initiatives,
      filterName: selectionKey ?? '',
      verboseName: (directoryField + ": " + title)
    };
    eventbus.publish({
      topic: "Map.addFilter",
      data: data
    });




    //setup sidebar buttons in initiative list
    const sidebarBtnHolder = selection.append("div").attr("class", "initiative-list-sidebar-btn-wrapper");


    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0 initiative-list-sidebar-btn")
      .attr("title", this.labels?.showSearch ?? '')
      .on("click", function () {

        eventbus.publish({
          topic: "Sidebar.hideInitiativeList",
        });
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        eventbus.publish({
          topic: "Initiatives.showSearchHistory",
        });
        eventbus.publish({
          topic: "Sidebar.showInitiatives",
        });

      })
      .append("i")
      .attr("class", "fa fa-search");



    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0")
      .attr("title", this.labels?.showInfo ?? '')
      .on("click", function () {
        eventbus.publish({
          topic: "Sidebar.hideInitiativeList",
        });
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        // eventbus.publish({
        // topic: "Map.removeSearchFilter"});
        eventbus.publish({
          topic: "Markers.needToShowLatestSelection",
          data: {
            selected: []
          }
        });
        eventbus.publish({
          topic: "Sidebar.showAbout",
        });
      })
      .append("i")
      .attr("class", "fa fa-info-circle");



    if (true) {
      sidebarBtnHolder
        .append("button")
        .attr("class", "w3-button w3-border-0")
        .attr("title", this.labels?.showDatasets ?? '')
        .on("click", function () {
          eventbus.publish({
            topic: "Sidebar.hideInitiativeList",
          });
          eventbus.publish({
            topic: "Markers.needToShowLatestSelection",
            data: {
              selected: []
            }
          });
          eventbus.publish({
            topic: "Sidebar.showDatasets",
          });
          // // eventbus.publish({
          // //   topic: "Map.removeSearchFilter",
          // //   });

        })
        .append("i")
        .attr("class", "fa fa-database");
    }



    sidebarBtnHolder
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button")
      .attr("title", this.labels.close + title)
      .on("click", function () {
        that.presenter.removeFilters(directoryField + selectionKey);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");



    selection
      .append("button")
      .attr("class", "w3-button w3-border-0 ml-auto sidebar-button sidebar-normal-size-close-btn")
      .attr("title", this.labels.close + title)
      .on("click", function () {
        that.presenter.removeFilters(directoryField + selectionKey);
      })
      .append("i")
      .attr("class", "fa " + "fa-times");

    selection
      .append("h2")
      .classed("sea-field", true)
      .text(title)
      .on("click", function () {
        // if (window.outerWidth <= 800) {
        //   eventbus.publish({
        //     topic: "Directory.InitiativeClickedSidebar.hideSidebar"
        //   });
        // }
        that.presenter.notifyMapNeedsToNeedsToBeZoomedAndPanned(initiatives);
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
        .text(initiative.name)
        .attr("data-uid", initiative.uri)
        .classed(activeClass, true)
        .classed(nongeoClass, true)
        .on("click", function () {
          eventbus.publish({
            topic: "Directory.InitiativeClicked",
            data: initiative
          });
        })
        .on("mouseover", function (_) {
          that.presenter.onInitiativeMouseoverInSidebar(initiative);
        })
        .on("mouseout", function (_) {
          that.presenter.onInitiativeMouseoutInSidebar(initiative);
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
            this.parent.updateSidebarWidth();
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
      .attr("title", this.labels.close + initiative.name)
      .on("click", function () {
        eventbus.publish({
          topic: "Directory.InitiativeClicked"
        });
      })
      .append("i")
      .attr("class", "fa " + "fa-times");
    initiativeContentElement
      .append("div")
      .html(initiativeContent);
    initiativeSidebar.classed("sea-initiative-sidebar-open", true);
    // if (document.getElementById("map-app-leaflet-map").clientWidth < 800)
    if (window.outerWidth < 800)
      eventbus.publish({
        topic: "Sidebar.showSidebar"
      });
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
