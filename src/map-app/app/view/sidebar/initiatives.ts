// The view aspects of the Main Menu sidebar
import * as d3 from 'd3';
import { BaseSidebarView } from './base';
import { InitiativesSidebarPresenter } from '../../presenter/sidebar/initiatives';
import type { d3Selection, d3DivSelection } from '../d3-utils';
import { Initiative } from '../../model/initiative';
import { toString as _toString } from '../../../utils';
import { SentryValues } from '../base';
import { propDefToVocabUri } from '../../model/data-services';

export class InitiativesSidebarView extends BaseSidebarView {
  readonly title: string;

  constructor(readonly presenter: InitiativesSidebarPresenter) {
    super();
    this.title = presenter.parent.mapui.labels.search;
  }

  populateFixedSelection(selection: d3Selection) {
    const labels = this.presenter.parent.mapui.labels;
    const container = selection
      .append("div")
      .attr("class", "w3-container");
    container
      .append("h1")
      .text(labels.search);

    this.createSearchBox(container);

    this.changeSearchText(this.presenter.parent.mapui.getSearchText());

    //advanced search
    const advancedSearchContainer = container
      .append("div")


    this.createAdvancedSearch(advancedSearchContainer);
  }

  onInitiativeClicked(id: string) {
    d3.select(".sea-search-initiative-active")
      .classed("sea-search-initiative-active", false);

    d3.select('[data-uid="' + id + '"]')
      .classed(
        "sea-search-initiative-active",
        true
      );
  }

  getSearchText(): string {
    return d3.select("#search-box").property("value");
  }

  changeSearchText(txt: string) {
    d3.select("#search-box").property("value", txt);
  }

  createSearchBox(selection: d3DivSelection) {

    const submitCallback = (event: Event) => {
      event.preventDefault(); // prevent page reloads on submit
      const searchText = this.getSearchText()
      this.presenter.performSearch(searchText);
    };

    const selection2 = selection
      .append("form")
      .attr("id", "map-app-search-form")
      .attr(
        "class",
        "w3-card-2 w3-round map-app-search-form"
      )
      .on("submit", submitCallback)
      .append("div")
      .attr("class", "w3-border-0");
    selection2
      .append("div")
      .attr("class", "w3-col")
      .attr("title", this.presenter.parent.mapui.labels.clickToSearch)
      .style("width", "50px")
      .append("button")
      .attr("type", "submit")
      .attr("class", "w3-btn w3-border-0")
      .append("i")
      .attr("class", "w3-xlarge fa fa-search");
    selection2
      .append("div")
      .attr("class", "w3-rest")
      .append("input")
      .attr("id", "search-box")
      .attr("class", "w3-input w3-border-0 w3-round w3-mobile")
      .attr("type", "search")
      .attr("placeholder", this.presenter.parent.mapui.labels.searchInitiatives)
      .attr("autocomplete", "off")
    // If we don't submit the search on blur, selecting another filter will reset the search text
    // https://github.com/digitalcommons/mykomap/issues/197
      .on("blur", submitCallback);


    document.getElementById("search-box")?.focus();
  }

  // used in the dropdown to change the filter
  private onChangeFilter(event: Event) {
    if (!event.target)
      return;
    const target = event.target; // Need some guarding here
    if (!(target instanceof HTMLSelectElement))
      return;
    //create the filter from the event of selecting the option
    const propName = target.id.split("-dropdown")[0];
    let filterValue: string|undefined = target.value;
    if (filterValue === SentryValues.OPTION_UNSELECTED)
      filterValue = undefined;
    this.presenter.changeFilters(propName, filterValue);
  }

  private createAdvancedSearch(container: d3DivSelection) {
    const mapui = this.presenter.parent.mapui;
    const propNames = mapui.config.getFilterableFields();
    const vocabs = mapui.dataServices.getVocabs();
    const lang = mapui.config.getLanguage();
    
    for(const propName of propNames) {
      const propDef = mapui.config.fields()[propName];
      if (!propDef) {
        throw new Error(`filterableFields contains ${propName}, which is not a valid field`);
      }
      const uri = propDefToVocabUri(propDef);
      if (!uri) {
        throw new Error(`filterableFields contains ${propName}, which is not a valid vocab field`);
      }
      
      let propTitle = propName;
      if (propDef.titleUri === undefined) {
        // Use the fields' vocab's title
        try {
          const vocab = vocabs.getVocabForUri(uri, lang);
          propTitle = vocab.title;
        }
        catch(e) {
          throw new Error(`filterableFields contains ${propName}, `+
            `which has an unresolvable vocab URI: '${uri}'`);
        }
      }
      else {
        // Look up the titleUri
        try {
          propTitle = vocabs.getTerm(propDef.titleUri, lang);
        }
        catch(e) {
          throw new Error(`filterableFields contains ${propName}, `+
            `which has an unresolvable URI in 'titleUri': '${propDef.titleUri}'`);
        }
      }

      container
        .append("p")
        .attr("id", propName + "-dropdown-label")
        .attr("class", "advanced-label")
        .text(propTitle)

      const dropDown = container
        .append("div")
        .append("select")
        .attr("id", propName + "-dropdown")
        .attr("class", "w3-input w3-border-0 w3-round w3-mobile advanced-select")
        .on("change", (event: Event) => this.onChangeFilter(event));

      dropDown
        .append("option")
        .text(`- ${mapui.labels.any} -`)
        .attr("value", SentryValues.OPTION_UNSELECTED)
        .attr("class", "advanced-option")


      const vocab = vocabs.getVocabForUri(uri, lang);
      const entryArray = Object.entries(vocab.terms);
      // Sort entries alphabetically by value (the human-readable labels)
      entryArray.sort((a, b) => String(a[1]).localeCompare(String(b[1])));


      const  alternatePossibleFilterValues = mapui.getAlternatePossibleFilterValues(propName);
      const filters = mapui.currentItem().propFilters;
      const filter = filters[propName];

      entryArray.forEach(entry => {
        const [value, label] = entry;
        const option = dropDown
          .append("option")
          .text(label ?? '')
          .attr("value", value)
          .attr("class", "advanced-option")

        // if there are active filters, label the one currently selected and disable empty choices
        if (filter && filter.valueRequired === value) {
          option.attr("selected", true);
        }
        if (!alternatePossibleFilterValues.has(value)) {
          option.attr("disabled", true);
        }
      })
    }
  }

  populateScrollableSelection(selection: d3Selection) {
    const labels = this.presenter.parent.mapui.labels;
    const appState = this.presenter.parent.mapui.currentItem();

    // add clear button
    selection
      .append("div")
      .attr("class", "w3-container w3-center sidebar-button-container")
      .attr("id", "clearSearchFilterBtn")
      .append("button")
      .attr("class", "w3-button w3-black")
      .property("disabled", this.presenter.isBackButtonDisabled() || undefined)
      .text(labels.clearFilters)
      .on("click", () => {
        this.presenter.resetSearch();
      });

    switch (appState.visibleInitiatives.size) {
      case 0: // No matches
        selection
            .append("div")
            .attr("class", "w3-container w3-center")
            .append("p")
            .text(labels.nothingMatched);
        break;

      default: // Matches
        this.populateSelectionWithListOfInitiatives(
          selection, appState.visibleInitiatives
        );
    }
  }

  private populateSelectionWithListOfInitiatives(
    selection: d3Selection,
    initiatives: Set<Initiative>
  ) {
    const initiativeClass = "w3-bar-item w3-button w3-mobile srch-initiative";
    initiatives.forEach((initiative) => {
      const uri = _toString(initiative.uri, null);
      if (!uri) {
        console.error("initiative with no uri field! ignoring...", initiative);
        return;
      }
      selection
        .append("button")
        .attr("class", initiativeClass)
        .classed("sea-initiative-non-geo", !initiative.hasLocation())
        .attr("data-uid", uri)
        .attr("title", this.presenter.parent.mapui.labels.clickForDetailsHereAndMap)
        .on("click", () => this.presenter.initClicked(initiative))
        .on("mouseover", () => this.presenter.onInitiativeMouseoverInSidebar(initiative) )
        .on("mouseout", () => this.presenter.onInitiativeMouseoutInSidebar(initiative) )
        .text(_toString(initiative.name));
    });
  }
}
