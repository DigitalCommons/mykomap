// The view aspects of the Main Menu sidebar
"use strict";
const { lab } = require('d3');
const d3 = require('d3');
const eventbus = require('../../eventbus');
const { BaseSidebarView } = require('./base');
const { InitiativesSidebarPresenter } = require('../../presenter/sidebar/initiatives');

const sectionHeadingClasses =
  "w3-bar-item w3-tiny w3-light-grey w3-padding-small";
const hoverColour = " w3-hover-light-blue";
const accordionClasses =
  "w3-bar-item w3-tiny w3-light-grey w3-padding-small" + hoverColour;
const sectionClasses = "w3-bar-item w3-small w3-white w3-padding-small";

export class InitiativesSidebarView extends BaseSidebarView {
	// And adds some overrides and new properties of it's own:
	title = "Initiatives";
  
  constructor(parent, config, labels, dataServices, mapPresenterFactory) {
    super();
    this.parent = parent;
    this.config = config;
    this.labels = labels;
    this.dataServices = dataServices;
    this.mapPresenterFactory = mapPresenterFactory;

		this.setPresenter(new InitiativesSidebarPresenter(this, labels, config, dataServices, mapPresenterFactory));
  }

	populateFixedSelection(selection) {
		const container = selection
			.append("div")
			.attr("class", "w3-container");
		container
			.append("h1")
			.text(this.labels.search);

		this.createSearchBox(container);

		let textContent = ""; // default content, if no initiatives to show
		if (this.presenter.currentItemExists() && this.presenter.currentItem()) {
			const item = this.presenter.currentItem();
			const initiatives = item.initiatives;
			// if (initiatives.length === 1) {
			//   //textContent = initiatives[0].name;
			//   textContent = "Search: " + item.searchString;
			// } else if (item.isSearchResults()) {
			//   textContent = "Search: " + item.searchString;
			// }
			textContent = this.labels.search + ": " + item.searchString;

			//change the text in the search bar
			eventbus.publish({
				topic: "Search.changeSearchText",
				data: {
					txt: item.searchedFor
				}
			});
		}

		container
			.append("p")
			.attr("id", "searchTooltipText")
			.text(textContent);

		//advanced search    
		const advancedSearchContainer = container
			.append("div")


		const terms = this.dataServices.getTerms();

		this.createAdvancedSearch(advancedSearchContainer, terms, this.presenter);

	}


	geekZoneContentAtD3Selection(selection, initiative) {
		const s = selection.append("div").attr("class", "w3-bar-block");
		if (initiative.lat) {
			s.append("div")
				.attr("class", sectionClasses)
				.text("Latitude: " + initiative.lat);
		}
		if (initiative.lng) {
			s.append("div")
				.attr("class", sectionClasses)
				.text("Longitude: " + initiative.lng);
		}
		if (initiative.uri) {
			s.append("div")
				.attr("class", sectionClasses + hoverColour)
				.text("Detailed data for this initiative")
				.style("cursor", "pointer")
				.on("click", (e) => {
					this.openInNewTabOrWindow(initiative.uri);
				});
		}
		if (initiative.within) {
			s.append("div")
				.attr("class", sectionClasses + hoverColour)
				.text("Ordnance Survey postcode information")
				.style("cursor", "pointer")
				.on("click", (e) => {
					this.openInNewTabOrWindow(initiative.within);
				});
		}
		if (initiative.regorg) {
			const serviceToDisplaySimilarCompanies =
				document.location.origin +
				document.location.pathname +
				config.getServicesPath() +
				"display_similar_companies/main.php";
			const serviceToDisplaySimilarCompaniesURL =
				serviceToDisplaySimilarCompanies +
				"?company=" +
				encodeURIComponent(initiative.regorg);
			s.append("div")
				.attr("class", sectionClasses + hoverColour)
				.attr("title", "A tech demo of federated Linked Open Data queries!")
				.text("Display similar companies nearby using Companies House data")
				.style("cursor", "pointer")
				.on("click", (e) => {
					this.openInNewTabOrWindow(serviceToDisplaySimilarCompaniesURL);
				});
		}
	}
	populateSelectionWithOneInitiative(selection, initiative) {
		const s = selection.append("div").attr("class", "w3-bar-block");
		if (initiative.www) {
			s.append("div")
				.attr("class", sectionHeadingClasses)
				.text("website");
			s.append("div")
				.attr("class", sectionClasses + hoverColour)
				.text(initiative.www)
				.style("cursor", "pointer")
				.on("click", (e) => {
					this.openInNewTabOrWindow(initiative.www);
				});
		}
		s.append("div")
			.attr("class", sectionHeadingClasses)
			.text("description");
		s.append("div")
			.attr("class", sectionClasses)
			.text(initiative.desc || "No description available");
		// Make an accordion for opening up the geek zone
		this.makeAccordionAtD3Selection({
			selection: s,
			heading: "Geek zone",
			headingClasses: accordionClasses,
			makeContentAtD3Selection: (contentD3Selection) => {
				this.geekZoneContentAtD3Selection(contentD3Selection, initiative);
			},
			hideContent: true
		});
	}

	onInitiativeClicked(id) {
		d3.select(".sea-search-initiative-active")
			.classed("sea-search-initiative-active", false);

		d3.select('[data-uid="' + id + '"]')
			.classed(
				"sea-search-initiative-active",
				true
			);
	}

	populateSelectionWithListOfInitiatives(
		selection,
		initiatives
	) {
		const pres = this.presenter;
		initiatives.forEach((initiative) => {
			let initiativeClass = "w3-bar-item w3-button w3-mobile srch-initiative";

			if (!initiative.hasLocation()) {
				initiativeClass += " sea-initiative-non-geo";
			}

			selection
				.append("button")
				.attr("class", initiativeClass)
				.attr("data-uid", initiative.uri)
				.attr("title", "Click to see details here and on map")
				// TODO - shift-click should remove initiative from selection,
				//        just like shift-clicking a marker.
				.on("click", function (e) {

					pres.initClicked(initiative);
				})
				.on("mouseover", function (e) {
					pres.onInitiativeMouseoverInSidebar(initiative);
				})
				.on("mouseout", function (e) {
					pres.onInitiativeMouseoutInSidebar(initiative);
				})
				.text(initiative.name);
		});
	}

	changeSearchText(txt) {

		d3.select("#search-box").property("value", txt);

	}

	createSearchBox(selection) {
		var view = this;

		selection = selection
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

				var searchText = d3.select("#search-box").property("value");

				view.presenter.performSearch(searchText);
			})
			.append("div")
			.attr("class", "w3-border-0");
		selection
			.append("div")
			.attr("class", "w3-col")
			.attr("title", "Click to search")
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
			.attr("placeholder", this.labels.searchInitiatives)
			.attr("autocomplete", "off");

		document.getElementById("search-box").focus();

	}

	createAdvancedSearch(container, values, presenter) {
		const currentFilters = this.mapPresenterFactory.getFilters();
		const item = presenter.currentItem();

		//function used in the dropdown to change the filter
		const changeFilter = (event) => {
			//create the filter from the event of selecting the option
			const filterCategoryName = event.target.id.split("-dropdown")[0];
			const filterValue = event.target.value;
			const filterValueText = event.target.selectedOptions[0].text;
			presenter.changeFilters(filterCategoryName, filterValue, filterValueText);

			//repeat the last search after changing the filter
			//if there is no last search, or the last search is empty, do a special search
			if (!item)
				presenter.performSearchNoText();
			else
				if (item.searchedFor == "")
					presenter.performSearchNoText();
				else
					presenter.performSearch(item.searchedFor);
		}

		const possibleFilterValues = this.dataServices.getPossibleFilterValues(this.mapPresenterFactory.getFiltered());
		const activeFilterCategories = this.mapPresenterFactory.getFiltersFull().map(filter =>
			filter.verboseName.split(":")[0]);

		for (const field in values) {
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
				.text(`- ${this.labels.any} -`)
				.attr("value", "any")
				.attr("class", "advanced-option")

			const entryArray = Object.entries(values[field]);
			// Sort entries alphabetically by value (the human-readable labels)
			entryArray.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

			//find alternative possible filters for an active filter
			let alternatePossibleFilterValues;
			if (currentFilters.length > 0 && activeFilterCategories.includes(field))
				alternatePossibleFilterValues = this.dataServices.getAlternatePossibleFilterValues(
					this.mapPresenterFactory.getFiltersFull(), field);

			entryArray.forEach(entry => {
				const [id, label] = entry;
				const option = dropDown
					.append("option")
					.text(label)
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

	populateScrollableSelection(selection) {
		var noFilterTxt = this.labels.whenSearch;
		var freshSearchText = this.presenter.getFilterNames().length > 0 ?
			" Searching in " + this.presenter.getFilterNames().join(", ") : noFilterTxt;

		if (this.presenter.currentItemExists() && this.presenter.currentItem()) {
			// add clear button
			if (this.presenter.getFilterNames().length > 0) {
				selection
					.append("div")
					.attr("class", "w3-container w3-center sidebar-button-container")
					.attr("id", "clearSearchFilterBtn")
					.append("button")
					.attr("class", "w3-button w3-black")
					.text(this.labels.clearFilters)
					.on("click", () => {
						//redo search
						this.presenter.removeFilters();
						if (item.searchedFor)
							this.presenter.performSearch(item.searchedFor);
						else
							this.presenter.performSearchNoText();
					});
			}

			const item = this.presenter.currentItem();

			const initiatives = item == null ? [] : item.initiatives;
			switch (initiatives.length) {
				case 0:
					if (item.isSearchResults()) {
						selection
							.append("div")
							.attr("class", "w3-container w3-center")
							.append("p")
							.text(this.labels.nothingMatched);
					}
					break;
				case 1:
					//this.populateSelectionWithOneInitiative(selection, initiatives[0]);
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
					.text(this.labels.clearFilters)
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
	getWindowHeight() {
		return d3.select("window").node().innerHeight;
	}
}
