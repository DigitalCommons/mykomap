// The view aspects of the Main Menu sidebar
import * as d3 from 'd3';
import { EventBus } from '../../../eventbus';
import {  BaseSidebarView  } from './base';
import {  InitiativesSidebarPresenter  } from '../../presenter/sidebar/initiatives';
import { Dictionary } from '../../../common-types';
import type { d3Selection, d3DivSelection } from '../d3-utils';
import { SearchResults } from '../../../search-results';
import { Initiative } from '../../model/initiative';
import { promoteToArray, toString as _toString } from '../../../utils';



export class InitiativesSidebarView extends BaseSidebarView {
	readonly title: string = 'Initiatives';
  
  constructor(readonly presenter: InitiativesSidebarPresenter) {
    super();
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

		let textContent = ""; // default content, if no initiatives to show
    const lastSearchResults = this.presenter.currentItem();
		if (lastSearchResults instanceof SearchResults) {
			textContent = labels.search + ": " + lastSearchResults.searchString;

			//change the text in the search bar
      EventBus.Search.changeSearchText.pub(lastSearchResults.searchedFor);
		}

		container
			.append("p")
			.attr("id", "searchTooltipText")
			.text(textContent);

		//advanced search    
		const advancedSearchContainer = container
			.append("div")


		const terms = this.presenter.parent.mapui.dataServices.getTerms();

		this.createAdvancedSearch(advancedSearchContainer, terms);
	}

	geekZoneContentAtD3Selection(selection: d3DivSelection, initiative: Initiative) {
		const s = selection.append("div").attr("class", "w3-bar-block");
		if (initiative.lat) {
			s.append("div")
				.attr("class", BaseSidebarView.sectionClasses)
				.text("Latitude: " + initiative.lat);
		}
		if (initiative.lng) {
			s.append("div")
				.attr("class", BaseSidebarView.sectionClasses)
				.text("Longitude: " + initiative.lng);
		}
    const uri = initiative.uri;
		if (typeof uri === 'string') {
			s.append("div")
				.attr("class", BaseSidebarView.sectionClasses + BaseSidebarView.hoverColour)
				.text("Detailed data for this initiative")
				.style("cursor", "pointer")
				.on("click", () => {
				 	this.openInNewTabOrWindow(uri);
				});
		}
    const within = initiative.within;
		if (typeof within === 'string') { // FIXME don't assume this property exists!
			s.append("div")
				.attr("class", BaseSidebarView.sectionClasses + BaseSidebarView.hoverColour)
				.text("Ordnance Survey postcode information")
				.style("cursor", "pointer")
				.on("click", () => {
					this.openInNewTabOrWindow(within);
				});
		}
	}
  
	populateSelectionWithOneInitiative(selection: d3Selection, initiative: Initiative) {
		const s = selection.append("div").attr("class", "w3-bar-block");
    const www = promoteToArray(initiative.www);
    // FIXME don't assume this property exists! Also, may be multi-valued
		if (www.length) {
			s.append("div")
				.attr("class", BaseSidebarView.sectionHeadingClasses)
				.text("website");
			s.append("div")
				.attr("class", BaseSidebarView.sectionClasses + BaseSidebarView.hoverColour)
				.text(_toString(www[0]))
				.style("cursor", "pointer")
				.on("click", () => {
					this.openInNewTabOrWindow(_toString(www[0]));
				});
		}
    const desc = _toString(initiative.desc, null);
		s.append("div")
			.attr("class", BaseSidebarView.sectionHeadingClasses)
			.text("description");
		s.append("div")
			.attr("class", BaseSidebarView.sectionClasses)
			.text(desc || "No description available");
    
		// Make an accordion for opening up the geek zone
		this.makeAccordionAtD3Selection({
			selection: s,
			heading: "Geek zone",
			headingClasses: BaseSidebarView.accordionClasses,
			makeContentAtD3Selection: (contentD3Selection: d3DivSelection) => {
				this.geekZoneContentAtD3Selection(contentD3Selection, initiative);
			},
			hideContent: true
		});
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

	populateSelectionWithListOfInitiatives(
		selection: d3Selection,
		initiatives: Initiative[]
	) {
		initiatives.forEach((initiative) => {
			let initiativeClass = "w3-bar-item w3-button w3-mobile srch-initiative";

			if (!initiative.hasLocation()) {
				initiativeClass += " sea-initiative-non-geo";
			}

      const uri = _toString(initiative.uri, null);
      if (uri)
			  selection
				  .append("button")
				  .attr("class", initiativeClass)
				  .attr("data-uid", uri)
				  .attr("title", "Click to see details here and on map")
			// TODO - shift-click should remove initiative from selection,
			//        just like shift-clicking a marker.
				  .on("click", () => this.presenter.initClicked(initiative))
				  .on("mouseover", () => this.presenter.onInitiativeMouseoverInSidebar(initiative) )
				  .on("mouseout", () => this.presenter.onInitiativeMouseoutInSidebar(initiative) )
				  .text(_toString(initiative.name));
		});
	}

  getSearchText(): string {
    return d3.select("#search-box").property("value");
  }
  
	changeSearchText(txt: string) {
		d3.select("#search-box").property("value", txt);
	}

	createSearchBox(selection: d3DivSelection) {
		const selection2 = selection
			.append("form")
			.attr("id", "map-app-search-form")
			.attr(
				"class",
				"w3-card-2 w3-round map-app-search-form"
			)
			.on("submit", (event) => {
				// By default, submitting the form will cause a page reload!
				event.preventDefault();
				//event.stopPropagation();

				var searchText = this.getSearchText()
				this.presenter.performSearch(searchText);
			})
			.append("div")
			.attr("class", "w3-border-0");
		selection2
			.append("div")
			.attr("class", "w3-col")
			.attr("title", "Click to search")
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
			.attr("autocomplete", "off");

		document.getElementById("search-box")?.focus();
	}

	createAdvancedSearch(container: d3DivSelection, vocabDict: Dictionary<Dictionary>) {
		const currentFilters = this.presenter.parent.mapui.filter.getFilterIds();
		const lastSearchResults = this.presenter.currentItem();

		//function used in the dropdown to change the filter
		const changeFilter = (event: Event) => {
      if (!event.target)
        return;
      const target = event.target; // Need some guarding here
      if (!(target instanceof HTMLSelectElement))
        return;
			//create the filter from the event of selecting the option
			const filterCategoryName = target.id.split("-dropdown")[0];
			const filterValue = target.value;
			const filterValueText = target.selectedOptions[0].text;

			this.presenter.changeFilters(filterCategoryName, filterValue, filterValueText);

			// After changing the filter, we need to repeat the last text
			// search on top of that, if there is one.
			if (lastSearchResults instanceof SearchResults) {
				if (lastSearchResults.searchedFor == "")
					this.presenter.performSearchNoText(); 
				else
					this.presenter.performSearch(lastSearchResults.searchedFor);
      }
			else
      	this.presenter.performSearchNoText();
		}

    const mapui = this.presenter.parent.mapui;
		const possibleFilterValues = mapui.dataServices.getPossibleFilterValues(mapui.filter.getFiltered());
		const activeFilterCategories = mapui.filter.getFiltersFull()
      .map(filter => filter.verboseName)
      .filter((name): name is string => name != undefined)
      .map(name => name.split(":")[0]);

		for (const field in vocabDict) {
			container
				.append("p")
				.attr("id", field + "dropdown-label")
				.attr("class", "advanced-label")
				.text(field)

			const dropDown = container
				.append("div")
				.append("select")
				.attr("id", field + "-dropdown")
				.attr("class", "w3-input w3-border-0 w3-round w3-mobile advanced-select")
				.on("change", (event) => changeFilter(event));

			dropDown
				.append("option")
				.text(`- ${mapui.labels.any} -`)
				.attr("value", "any")
				.attr("class", "advanced-option")

      const vocabTerms = vocabDict[field]
      if (!vocabTerms)
        continue;
      
			const entryArray = Object.entries(vocabTerms);
			// Sort entries alphabetically by value (the human-readable labels)
			entryArray.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

			//find alternative possible filters for an active filter
			let alternatePossibleFilterValues: unknown[] = [];
			if (currentFilters.length > 0 && activeFilterCategories.includes(field)) {
        const filters = mapui.filter.getFiltersFull();
				alternatePossibleFilterValues = mapui.dataServices.getAlternatePossibleFilterValues(
					filters, field
        );
      }
			entryArray.forEach(entry => {
				const [id, label] = entry;
				const option = dropDown
					.append("option")
					.text(label ?? '')
					.attr("value", id)
					.attr("class", "advanced-option")

				//if there are active filters, make them selected and disable empty choices
				if (currentFilters.length > 0) {
					if (currentFilters.includes(id))
						option.attr("selected", true);

					if (activeFilterCategories.includes(field)) {
						if (currentFilters.length > 1 && !alternatePossibleFilterValues.includes(id))
							option.attr("disabled", true);
					}
					else
						if (!possibleFilterValues.includes(id)) {
							option.attr("disabled", true);
						}
				}
			})
		}
	}

	populateScrollableSelection(selection: d3Selection) {
    const labels = this.presenter.parent.mapui.labels;
		const noFilterTxt = labels.whenSearch;
		const freshSearchText = this.presenter.getFilterNames().length > 0 ?
			" Searching in " + this.presenter.getFilterNames().join(", ") : noFilterTxt;

    const lastSearchResults = this.presenter.currentItem();
		if (lastSearchResults instanceof SearchResults) {
			// add clear button
			if (this.presenter.getFilterNames().length > 0) {
				selection
					.append("div")
					.attr("class", "w3-container w3-center sidebar-button-container")
					.attr("id", "clearSearchFilterBtn")
					.append("button")
					.attr("class", "w3-button w3-black")
					.text(labels.clearFilters)
					.on("click", () => {
						//redo search
						this.presenter.removeFilters();
						if (lastSearchResults.searchedFor)
							this.presenter.performSearch(lastSearchResults.searchedFor);
						else
							this.presenter.performSearchNoText();
					});
			}

			const initiatives = lastSearchResults == null ? [] : lastSearchResults.initiatives;
			switch (initiatives.length) {
				case 0:
					selection
							.append("div")
							.attr("class", "w3-container w3-center")
							.append("p")
							.text(labels.nothingMatched);

					break;
				case 1:
					//this.populateSelectionWithO neInitiative(selection, initiatives[0]);
					this.populateSelectionWithListOfInitiatives(selection, initiatives);
					break;
				default:
					this.populateSelectionWithListOfInitiatives(selection, initiatives);
			}

		}
		else {
			selection
				.append("div")
				.attr("class", "w3-container w3-center")
				.attr("id", "searchTooltipId")
				.append("p")
				.text(
					freshSearchText
				);
			// add clear button
			if (this.presenter.getFilterNames().length > 0) {
				selection
					.append("div")
					.attr("class", "w3-container w3-center")
					.attr("id", "clearSearchFilterBtn")
					.append("button")
					.attr("class", "w3-button w3-black")
					.text(labels.clearFilters)
					.on("click", () => {
						// only remove filters and and reset text, no re-search needed
						this.presenter.removeFilters();
						this.presenter.performSearchNoText();
						selection.select("#searchTooltipId").text(noFilterTxt);
						selection.select("#clearSearchFilterBtn").remove();
					});
			}
		}

	}
}
