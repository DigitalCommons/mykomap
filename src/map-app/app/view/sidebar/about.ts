// The view aspects of the About sidebar
import { BaseSidebarView  } from './base';
import { Dictionary } from '../../../common_types';
import { Config } from '../../model/config';
import { d3Selection } from '../d3-utils';
import { SidebarView } from '../sidebar';
import { AboutSidebarPresenter } from '../../presenter/sidebar/about';

export class AboutSidebarView extends BaseSidebarView {
  readonly presenter: AboutSidebarPresenter;
  
  // And adds some overrides and new properties of it's own:
  readonly title = "about";
  hasHistoryNavigation = false; // No forward/back buttons for this sidebar

  constructor(readonly parent: SidebarView, readonly labels: Dictionary, readonly config: Config) {
    super();
    this.presenter = new AboutSidebarPresenter(this);
  }

  populateFixedSelection(selection: d3Selection) {
    const textContent = this.labels?.aboutTitle ?? '';
    selection
      .append("div")
      .attr("class", "w3-container")
      .append("h1")
      .text(textContent);
  }

  populateScrollableSelection(selection: d3Selection) {
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
    
    selection.append('div')
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
