// The view aspects of the Main Menu sidebar
import * as d3 from 'd3';
import { BaseSidebarView } from './base';
import { InitiativesSidebarPresenter } from '../../presenter/sidebar/initiatives';
import type { d3Selection, d3DivSelection } from '../d3-utils';
import { EventBus } from '../../../eventbus';
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

    this.createFilterCount(container);

    //advanced search
    const advancedSearchContainer = container
      .append("div")


    this.createAdvancedSearch(advancedSearchContainer);

    this.createShowResultsButton(container);
  }

  getSearchText(): string {
    return d3.select("#search-box").property("value");
  }

  changeSearchText(txt: string) {
    d3.select("#search-box").property("value", txt);
  }

  createSearchBox(container: d3DivSelection) {
    const submitCallback = (event: Event) => {
      event.preventDefault(); // prevent page reloads on submit
  
      const oldSearchText = this.presenter.parent.mapui.getSearchText()
      const newSearchText = this.getSearchText();
  
      if (newSearchText !== oldSearchText) {
        this.presenter.performSearch(newSearchText);
      }
    };

    const form = container
      .append("form")
      .attr("id", "map-app-search-form")
      .attr(
        "class",
        "w3-card-2 w3-round map-app-search-form"
      )
      .on("submit", submitCallback);
    
    const selection = form
      .append("div")
      .attr("class", "w3-border-0");

    selection
      .append("div")
      .attr("class", "w3-col")
      .attr("title", this.presenter.parent.mapui.labels.clickToSearch)
      .style("width", "50px")
      .append("button")
      .attr("type", "submit")
      .attr("class", "w3-btn w3-border-0")
      .append("i")
      .attr("class", "w3-xlarge fa fa-search");
    
    selection
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
  }

  private createFilterCount(container: d3DivSelection) {
    const appState = this.presenter.parent.mapui.currentItem();
    const labels = this.presenter.parent.mapui.labels;
    
    const count = appState.visibleInitiatives.size;
    const filterApplied = appState.hasPropFilters || appState.hasTextSearch;

    const selection = container
      .append("div")
      .attr("class", "map-app-search-filter-count")
      .append("p");
    
    selection
      .append("span")
      .attr("class", "filter-count-value")
      .text(count);
    
    selection
      .append("span")
      .attr("class", "filter-count-descriptor")
      .text(` ${filterApplied ? labels.matchingResults : labels.directoryEntries}`);
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
    const filtered = mapui.config.getFilteredPropDefs();
    const vocabs = mapui.dataServices.getVocabs();
    const lang = mapui.config.getLanguage();
    
    for(const propName in filtered) {
      const propDef = filtered[propName];
      const uri = propDefToVocabUri(propDef);
      if (!uri) {
        throw new Error(`to be a filtered property, '${propName}' should be a vocab field, but is not`);
      }
      
      let propTitle = propName;
      if (vocabs !== undefined) {
        if (propDef.titleUri === undefined) {
          // Use the fields' vocab's title
          try {
            const vocab = vocabs.getVocab(uri, lang);
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


      if (vocabs !== undefined) {
        const vocab = vocabs.getVocab(uri, lang);
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
  }

  private createShowResultsButton(container: d3DivSelection) {
    const labels = this.presenter.parent.mapui.labels;

    container
      .append("div")
      .attr("class", "w3-container w3-center mobile-only show-results-button-container")
      .append("button")
      .attr("class", "w3-button w3-round w3-border-dark-grey show-results-button")
      .text(labels.showResults.toLocaleUpperCase())
      .on("click", () => EventBus.Sidebar.showInitiativeList.pub());
  }

  populateScrollableSelection(selection: d3Selection) {
    // No scrollable section
  }
}
