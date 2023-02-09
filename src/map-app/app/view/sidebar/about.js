// The view aspects of the About sidebar
"use strict";
const d3 = require('d3');
const eventbus = require('../../eventbus');
const { BaseSidebarView } = require('./base');
const { AboutPresenter } = require('../../presenter/sidebar/about');

// TODO These same consts are here and in view/sidebar/initiative.
//      Find a common place for them.
const sectionHeadingClasses =
  "w3-bar-item w3-tiny w3-light-grey w3-padding-small";
const hoverColour = " w3-hover-light-blue";
const accordionClasses =
  "w3-bar-item w3-tiny w3-light-grey w3-padding-small" + hoverColour;
const sectionClasses = "w3-bar-item w3-small w3-white w3-padding-small";


export class AboutSidebarView extends BaseSidebarView {
  // And adds some overrides and new properties of it's own:
  title = "about";
  hasHistoryNavigation = false; // No forward/back buttons for this sidebar

  constructor(parent, labels, config) {
    super();
    this.parent = parent;
    this.labels = labels;
    this.config = config;
    this.presenter = new AboutPresenter(this);
  }

  populateFixedSelection(selection) {
    let textContent = this.labels.aboutTitle;
    selection
      .append("div")
      .attr("class", "w3-container")
      .append("h1")
      .text(textContent);
  }

  populateScrollableSelection(selection) {
    const that = this;

    const lang = this.config.getLanguage();
    
    // We need to be careful to guard against weird characters, especially quotes,
    // from the language code, as these can create vulnerabilities.
    if (lang.match(/[^\w -]/))
      throw new Error(`rejecting suspect language code '${lang}'`);
    
    selection
      .append('div')
      .attr("class", "w3-container about-text")
      .html(this.config.aboutHtml())
    // Remove all elements which have a language tag which is not the target language tag
      .selectAll(`[lang]:not([lang='${lang}'])`)
      .remove();
    
    const dataSection = selection.append('div')
                                 .attr("class", "w3-container about-data");

    
    /*********************************************************************************
     * COMMENTED PENDING A REVIEW/REFRESH OF THE DATA AND WIKI DOCS
    const sourceParag = dataSection.append('p')
    sourceParag.text(this.labels.source)

    const li = sourceParag
      .append('ul')
      .selectAll('li')
      .data(Object.values(dataServices.getDatasets()))
      .enter()
      .append('li');

    // Different data sources currently need different code here.
    // Ideally make this more uniform later
    li
      .filter(d => d.type !== 'hostSparql') // non hostSparql
      .text(d => d.label);
    
    li
      .filter(d => d.type === 'hostSparql') // The rest is hostSparql specific currently
      .append('a')
      .text(d => d.label)
      .attr('target', '_blank')
          .attr('href', d => {
            console.log(d)
        if (typeof d?.loader?.meta?.default_graph_uri === 'string') {
          // ensure URI has trailing slash, needed for lod.coop
          return d.loader.meta.default_graph_uri.replace(/\/*$/, '/');
        }
        return '#'; // placeholder
      });

    dataSection.append('p')
      .text(this.labels.technicalInfo);

    const technicalInfoUrl = 'https://github.com/DigitalCommons/mykomap/wiki';
    dataSection
      .append('p')
      .append('a')
      .text(technicalInfoUrl)
      .attr('href', technicalInfoUrl)
      .attr('target', '_blank');

    *********************************************************************************/
    
    // If a version is available display it
    const version = this.config.getVersionTag();
    if (version) {
      selection
        .append("div")
        .attr("class", "w3-container about-version")
        .append("p")
        .attr("style", "font-style: italic;")
        .text(`mykomap@${version}`);
    }
  }

}
