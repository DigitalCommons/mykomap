// The view aspects of the Main Menu sidebar
"use strict";
const { lab } = require('d3');
const d3 = require('d3');
const eventbus = require('../../eventbus')

function init(registry) {
	const config = registry('config');
	const sidebarView = registry('view/sidebar/base');
	const presenter = registry('presenter/sidebar/initiatives');
	const sseInitiative = registry('model/sse_initiative');
	const map = registry('presenter/map');

	//get labels for buttons and titles
	const labels = sseInitiative.getFunctionalLabels();

	// Our local Sidebar object:
	function Sidebar() { }

	// Our local Sidebar inherits from sidebar:
	var proto = Object.create(sidebarView.base.prototype);

	// And adds some overrides and new properties of it's own:
	proto.title = "Initiatives";

	const sectionHeadingClasses =
		"w3-bar-item w3-tiny w3-light-grey w3-padding-small";
	const hoverColour = " w3-hover-light-blue";
	const accordionClasses =
		"w3-bar-item w3-tiny w3-light-grey w3-padding-small" + hoverColour;
	const sectionClasses = "w3-bar-item w3-small w3-white w3-padding-small";

	proto.populateFixedSelection = function (selection) {
		const container = selection
			.append("div")
			.attr("class", "w3-container");
		container
			.append("h1")
			.text(labels.search);

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
			textContent = labels.search + ": " + item.searchString;

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


		const terms = sseInitiative.getTerms();

		this.createAdvancedSearch(advancedSearchContainer, terms, this.presenter);

	};


	proto.onInitiativeClicked = function (id) {
		d3.select(".sea-search-initiative-active")
			.classed("sea-search-initiative-active", false);

		d3.select('[data-uid="' + id + '"]')
			.classed(
				"sea-search-initiative-active",
				true
			);
	};

	proto.populateSelectionWithListOfInitiatives = function (
		selection,
		initiatives
	) {
		const pres = this.presenter;
		const that = this;
		initiatives.forEach(function (initiative) {
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
	};

	proto.changeSearchText = function (txt) {

		d3.select("#search-box").property("value", txt);

	};

	proto.createSearchBox = function (selection) {
		var view = this;

		selection = selection
			.append("form")
			.attr("id", "map-app-search-form")
			.attr(
				"class",
				"w3-card-2 w3-round map-app-search-form"
			)
			.on("submit", function () {
				// By default, submitting the form will cause a page reload!
				d3.event.preventDefault();
				//d3.event.stopPropagation();

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
			.attr("placeholder", labels.searchInitiatives)
			.attr("autocomplete", "off");

		document.getElementById("search-box").focus();

	};

	proto.createAdvancedSearch = (container, values, presenter) => {
		const currentFilters = map.getFilters();
		const item = presenter.currentItem();

		//function used in the dropdown to change the filter
		const changeFilter = () => {
			//create the filter from the event of selecting the option
			const filterCategoryName = d3.event.target.id.split("-dropdown")[0];
			const filterValue = d3.event.target.value;
			const filterValueText = d3.event.target.selectedOptions[0].text;
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
		};

		const possibleFilterValues = sseInitiative.getPossibleFilterValues(map.getFiltered());
		const activeFilterCategories = map.getFiltersFull().map(filter =>
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
				.on("change", () => changeFilter());

			dropDown
				.append("option")
				.text(`- ${labels.any} -`)
				.attr("value", "any")
				.attr("class", "advanced-option")

			const entryArray = Object.entries(values[field]);
			// Sort entries alphabetically by value (the human-readable labels)
			entryArray.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

			//find alternative possible filters for an active filter
			let alternatePossibleFilterValues;
			if (currentFilters.length > 0 && activeFilterCategories.includes(field))
				alternatePossibleFilterValues = sseInitiative.getAlternatePossibleFilterValues(
					map.getFiltersFull(), field);

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

	proto.populateScrollableSelection = function (selection) {
		var that = this;
		var noFilterTxt = labels.whenSearch;
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
					.text(labels.clearFilters)
					.on("click", function () {
						//redo search
						console.log("this one")
						that.presenter.removeFilters();
						if (item.searchedFor)
							that.presenter.performSearch(item.searchedFor);
						else
							that.presenter.performSearchNoText();
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
							.text(labels.nothingMatched);
					}
					break;
				case 1:
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
					.on("click", function () {
						// only remove filters and and reset text, no re-search needed
						that.presenter.removeFilters();
						that.presenter.performSearchNoText();
						selection.select("#searchTooltipId").text(noFilterTxt);
						selection.select("#clearSearchFilterBtn").remove();
					});
			}
		}

	};
	proto.getWindowHeight = function () {
		return d3.select("window").node().innerHeight;
	};

	Sidebar.prototype = proto;

	function createSidebar() {
		var view = new Sidebar();
		view.setPresenter(presenter.createPresenter(view));

		return view;
	}
	return {
		createSidebar: createSidebar
	};
}


module.exports = init;
