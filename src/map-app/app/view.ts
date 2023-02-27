import * as d3 from 'd3';
import '../map-app.css'; // Required to embed styles 
import { Config } from './model/config';
import { MapPresenterFactory } from "../app/presenter/map";
import { MarkerViewFactory } from "./view/map/marker";
import { getPopup } from "./view/map/default_popup";
import { SidebarView } from './view/sidebar';
import { MapView } from "./view/map";
import { DataServices } from './model/dataservices';


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
  // Each view will ensure that the code for its presenter is loaded.
  const popup = config.getCustomPopup() || getPopup;
  const markerViewFactory = new MarkerViewFactory(config.getDefaultLatLng(), popup, dataServices);
  
  // This is here to resolve a circular dependency loop - MapPresenterFactory needs the SidebarView
  // when it runs, but SidebarView needs a link to the MapPresenterFactory.
  // Maybe later the code can be untangled further so there is no loop.
  const mkSidebarView = (mapPresenterFactory: MapPresenterFactory) => {
    return new Promise<SidebarView>((resolve) => {
      const sidebarView = new SidebarView(
        dataServices.getFunctionalLabels(),
        config,
        dataServices,
        markerViewFactory,
        mapPresenterFactory,
        dataServices.getSidebarButtonColour()
      );
      resolve(sidebarView);
    });
  };

  const mapPresenterFactory =  new MapPresenterFactory(
    config,
    dataServices,
    markerViewFactory,
    mkSidebarView
  );

  const dialogueSize = dataServices.getDialogueSize();
  const mapView = new MapView(
    mapPresenterFactory,
    dataServices.getFunctionalLabels(),
    dialogueSize.height,
    dialogueSize.width,
    dialogueSize.descriptionRatio,
    markerViewFactory
  );

  insertPageTitle(config);
  mapView.createMap();
  mapPresenterFactory.map = mapView.map; // Link this back for views to access
}
