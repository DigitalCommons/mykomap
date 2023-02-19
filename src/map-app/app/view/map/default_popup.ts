// FIXME prevent malicious content in replacements (like description)
import type { DataServices } from "../../model/dataservices";
import type { Initiative } from "../../model/initiative";

export function htmlEscape(str: string) {
  if (str == null) // deliberately loose equality
    return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getAddress(initiative: Initiative) {
  // We want to add the whole address into a single paragraph.
  // Not all orgs have an address, however.
  let address = [] as string[];
  if (initiative.street)
    address = address.concat(
      String(initiative.street)
        .split(';')
        .map(elem => elem.trim())
        .filter(elem => elem !== initiative.name)
        .map(htmlEscape)
    );
  address = address.concat(
    [initiative.locality,
     initiative.region,
     initiative.postcode].map(htmlEscape)
  )
  if (!initiative.hasLocation())
    address.push('<i>NO LOCATION AVAILABLE</i>');

  return address.join('<br/>\n        ');
}

export function getEmail(initiative: Initiative) {
  // Not all orgs have an email
  if (initiative.email)
    return `<a class="fa fa-at" href="mailto:${initiative.email}" target="_blank" ></a>`;
  return "";
}

export function getFacebook(initiative: Initiative) {
  // not all have a facebook
  if (initiative.facebook)
    return `<a class="fab fa-facebook" href="https://facebook.com/${initiative.facebook}" target="_blank" ></a>`;
  return "";
}  

export function getTwitter(initiative: Initiative) {
  // not all have twitter
  if (initiative.twitter)
    return `<a class="fab fa-twitter" href="https://twitter.com/${initiative.twitter}" target="_blank" ></a>`;
  return '';
}

export function getPopup(initiative: Initiative, dataservices: DataServices): string {
  const labels = dataservices.getFunctionalLabels();
  let popupHTML = `
    <div class="sea-initiative-details">
      <h2 class="sea-initiative-name">${initiative.name}</h2>
      <p>${initiative.desc || ''}</p>
    </div>
    
    <div class="sea-initiative-contact">
      <h3>${labels.contact}</h3>
      ${getAddress(initiative)}
      
      <div class="sea-initiative-links">
        ${getEmail(initiative)}
        ${getFacebook(initiative)}
        ${getTwitter(initiative)}
      </div>
    </div>
  `;
  
  return popupHTML;
}
