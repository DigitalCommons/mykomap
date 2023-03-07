import * as d3 from 'd3';
import '../map-app.css'; // Required to embed styles 
import { Config } from './model/config';
import { MapUI } from "../app/map-ui";
import { DataServices } from './model/data-services';


function insertPageTitle(config: Config): void {
  const lang = config.getLanguage();
  
  // We need to be careful to guard against weird characters, especially quotes,
  // from the language code, as these can create vulnerabilities.
  if (lang.match(/[^\w -]/))
    throw new Error(`rejecting suspect language code '${lang}'`);
  
  let title = config.htmlTitle();
  const about = config.aboutHtml();
  
  if (!title && about) {
    // Look for a title tag in about.html

    // Create a temp node to inspect the about html
    const temp =
      d3.select("head")
        .insert("div") // make a temp node
        .html(about) // insert the whole text temporarily

    // Try title[lang=$lang] first
    let tempTitleNode =
      temp.select(`title[lang='${lang}']`);

    // Fall back to title with no lang attribute
    if (tempTitleNode.empty())
      tempTitleNode = temp.select('title:not([lang])');

    if (!tempTitleNode.empty())
      title =
        tempTitleNode.text(); // Get the text

    // Remove the temp node
    temp.remove();
  }

  // Set the title, if available
  if (title) {
    const titleNode = d3.select("html head title");
    titleNode.text(title);
  }
}


export function initUI(config: Config, dataServices: DataServices) {
  insertPageTitle(config);
  
  const mapui = new MapUI(
    config,
    dataServices,
  );

  mapui.createMap();
}
