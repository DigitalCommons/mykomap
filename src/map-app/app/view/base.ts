import * as d3 from 'd3';
import { d3Selection, d3DivSelection } from './d3-utils';

// 'Base class' for all views:
//
// Prior to the conversion to an ES/TypeScript class, a note on this
// class ssuggsted in future to use his base for the older view
// objects - as they were created originally before this base existed.
export class BaseView<P> {
  constructor(public presenter?: P) {}
  
  setPresenter(p: P) {
    this.presenter = p;
  }

  d3selectAndClear(selector: string): d3Selection {
    // adds a log for failed selectors
    // Clears the innerHtml, ready for re-populating using .append()
    var selection = d3.select(selector);
    if (selection.empty()) {
      console.log("Unexpectedly cannot find match for selector: " + selector);
    } else {
      selection.html("");
    }
    return selection;
  }
  
  htmlToOpenLinkInNewTab(url: string, text: string, options?: { title: string }): string {
    const title = (options && options.title) || "Click to open in a new tab";
    return (
      '<a title="' +
      title +
      '" href="' +
      url +
      '" rel="noopener noreferrer" target="_blank">' +
      text +
      "</a>"
    );
  }
  
  openInNewTabOrWindow(url: string): void {
    // TODO - do we need to check for popup-blockers?
    //        See https://stackoverflow.com/questions/2914/how-can-i-detect-if-a-browser-is-blocking-a-popup
    window.open(url, "_blank")?.focus();
  }

  makeAccordionAtD3Selection(opts: {selection: d3DivSelection,
                                    heading: string, headingClasses: string,
                                    makeContentAtD3Selection: (s: d3DivSelection) => void,
                                    hideContent: true}) {
    // See example: https://www.w3schools.com/w3css/tryit.asp?filename=tryw3css_accordion_sidebar
    const accordion = opts.selection
                          .append("div")
                          .attr("class", opts.headingClasses)
                          .style("cursor", "pointer")
                          .html(opts.heading + " " + '<i class="fa fa-caret-down"></i>');
    // The contentWrapper is a div around the content. It's where we control whether the content
    // is shown or hidden.
    const contentWrapper = opts.selection
                               .append("div")
                               .classed(opts.hideContent ? "w3-hide" : "w3-show", true);
    function setAccordionTitle(wrapper: d3DivSelection) {
      accordion.attr(
        "title",
        "Click to " +
            (wrapper.classed("w3-hide") ? "show" : "hide") +
        " " +
        opts.heading
      );
    }
    setAccordionTitle(contentWrapper);
    
    // Now put the content inside the contentWrapper:
    opts.makeContentAtD3Selection(contentWrapper);
    
    // Manipulate the visibility of the content via the contentWrapper, when the accorion is clicked:
    accordion.on("click", (_) => {
      //console.log("accordion clicked");
      //console.log(contentWrapper.attr('class'));
      if (contentWrapper.classed("w3-hide")) {
        contentWrapper.classed("w3-hide", false);
        contentWrapper.classed("w3-show", true);
      } else if (contentWrapper.classed("w3-show")) {
        contentWrapper.classed("w3-show", false);
        contentWrapper.classed("w3-hide", true);
      } else {
        console.log(
          "Unexpectedly found neither w3-hide nor w3-show classes in wrapper div for accordion contentWrapper"
        );
      }
      setAccordionTitle(contentWrapper);
    });
  }
}
