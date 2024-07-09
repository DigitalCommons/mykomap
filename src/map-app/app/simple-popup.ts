/** This popup is shown if the initiative has not been loaded yet, so is just populated using the
 * info available in the GeoJSON data */

import type { DataServices } from "./model/data-services";

export function getPopup(name: string, dataservices: DataServices): string {
  const labels = dataservices.getFunctionalLabels();
  let popupHTML = `
    <div class="sea-initiative-details">
      <h2 class="sea-initiative-name">${name}</h2>
    </div>
    
    <div class="sea-initiative-contact">
      <p>Fetch other details with backend API...</p>
    </div>
  `;
  
  return popupHTML;
}
