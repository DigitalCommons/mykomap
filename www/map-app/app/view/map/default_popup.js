"use strict";

var getLatLng = function (initiative) {
  return [initiative.lat, initiative.lng];
};
var getHoverText = function (initiative) {
  return initiative.name;
};
var prettyPhone = function (tel) {
  return tel.replace(/^(\d)(\d{4})\s*(\d{6})/, "$1$2 $3");
};

var getPopup = function (initiative, sse_initiatives, labels) {
  const values = sse_initiatives.getVerboseValuesForFields()
  let orgStructures = values["Organisational Structure"];
  let activitiesVerbose = values["Activities"];
  let address = "",
      street,
      locality,
      postcode,
      dotcoop =
        initiative.dataset.includes("dotcoop"),
      popupHTML =
        '<div class="sea-initiative-details">' +
        '<h2 class="sea-initiative-name">{initiative.name}</h2>' +
        "{initiative.www}" +
        '<h4 class="sea-initiative-org-structure">{initiative.org-structure}</h4>' +
        '<h4 class="sea-initiative-economic-activity">Activity: {initiative.economic-activity}</h4>' +
        '<h5 class="sea-initiative-secondary-activity">Secondary Activities: {initiative.secondary-activity}</h5>' +
        "<p>{initiative.desc}</p>" +
        "{dotcoop.domains}" +
        "</div>" +
        '<div class="sea-initiative-contact">' +
        `<h3>${labels.contact}</h3>` +
        "{initiative.address}" +
        "{initiative.tel}" +
        '<div class="sea-initiative-links">' +
        "{initiative.email}" +
        "{initiative.facebook}" +
        "{initiative.twitter}" +
        "</div>" +
        "</div>";
  // All initiatives should have a name
  popupHTML = popupHTML.replace("{initiative.name}", initiative.name);
  // TODO Add org type
  if (initiative.orgStructure && initiative.orgStructure.length > 0 && orgStructures) {
    let repl = initiative.orgStructure.map(OS => orgStructures[OS]).join(", ");
    popupHTML = popupHTML.replace(
      "{initiative.org-structure}",
      repl
    );
  }
  //comment this out 
  else {
    if (initiative.regorg && orgStructures) {
      popupHTML = popupHTML.replace(
        "{initiative.org-structure}",
        orgStructures[initiative.regorg]
      );
    } else {
      popupHTML = popupHTML.replace(
        "{initiative.org-structure}",
        ""
      );
    }

  }

  if (initiative.primaryActivity && initiative.primaryActivity != "" && activitiesVerbose) {

    popupHTML = popupHTML.replace(
      "{initiative.economic-activity}",
      activitiesVerbose[initiative.primaryActivity]
    );
  } else {
    popupHTML = popupHTML.replace(
      "Activity: {initiative.economic-activity}",
      ""
    );

  }
  if (initiative.otherActivities && initiative.otherActivities.length > 0 && activitiesVerbose) {
    let repl = initiative.otherActivities.map(AM => activitiesVerbose[AM]).join(", ");
    popupHTML = popupHTML.replace(
      "{initiative.secondary-activity}",
      repl
    );
  }
  //comment this out
  else {
    if (initiative.activity) {
      popupHTML = popupHTML.replace(
        "{initiative.secondary-activity}",
        orgStructures[initiative.activity]
      );
    } else {
      popupHTML = popupHTML.replace(
        "Secondary Activities: {initiative.secondary-activity}",
        ""
      );
    }

  }



  // All initiatives should have a description (this isn't true with dotcoop)
  popupHTML = popupHTML.replace("{initiative.desc}", initiative.desc || "");

  // If we're building a dotcoop map then list the domains
  if (initiative.www && dotcoop) {
    let domains = initiative.www.split(";");
    var domainsList = "<p>Domains</p><ul>";
    for (let domain of domains) {
      domainsList += '<li><a href="' + domain + '" target="_blank" >' + domain + "</a></li>";
    }
    domainsList += "</ul>";
  }
  popupHTML = popupHTML.replace(
    "{dotcoop.domains}",
    domainsList ? domainsList : ""
  );

  // We want to add the whole address into a single para
  // Not all orgs have an address
  if (initiative.street) {
    let streetArray = initiative.street.split(";");
    for (let partial of streetArray) {
      if (partial === initiative.name) continue;
      if (street) street += "<br/>";
      street = street ? (street += partial) : partial;
    }
    address += street;
  }
  if (initiative.locality) {
    address += (address.length ? "<br/>" : "") + initiative.locality;
  }
  if (initiative.region) {
    address += (address.length ? "<br/>" : "") + initiative.region;
  }
  if (initiative.postcode) {
    address += (address.length ? "<br/>" : "") + initiative.postcode;
  }
  if (initiative.countryId) {
    address += (address.length ? "<br/>" : "") + initiative.countryId;
  }
  if (initiative.nongeo == 1 || !initiative.lat || !initiative.lng) {
    address += (address.length ? "<br/>" : "") + "<i>NO LOCATION AVAILABLE</i>";
  }
  if (address.length) {
    address = '<p class="sea-initiative-address">' + address + "</p>";
  }
  popupHTML = popupHTML.replace("{initiative.address}", address);

  // Not all orgs have an email
  if (initiative.email) {
    popupHTML = popupHTML.replace(
      "{initiative.email}",
      '<a class="fa fa-at" href="mailto:' + initiative.email + '" target="_blank" ></a>'
    );
  } else popupHTML = popupHTML.replace("{initiative.email}", "");

  // not all have twitter
  if (initiative.twitter) {
    popupHTML = popupHTML.replace(
      "{initiative.twitter}",
      '<a class="fab fa-twitter" href="https://twitter.com/' + initiative.twitter + '" target="_blank" ></a>'
    );
  } else popupHTML = popupHTML.replace("{initiative.twitter}", "");

  // not all have a facebook
  if (initiative.facebook) {
    popupHTML = popupHTML.replace(
      "{initiative.facebook}",
      '<a class="fab fa-facebook" href="https://facebook.com/' + initiative.facebook + '" target="_blank" ></a>'
    );
  } else popupHTML = popupHTML.replace("{initiative.facebook}", "");

  // Not all orgs have a phone number
  popupHTML = popupHTML.replace(
    "{initiative.tel}",
    initiative.tel
    ? '<p class="sea-initiative-tel">' +
      prettyPhone(initiative.tel) +
      "</p>"
                  : ""
  );
  // Not all orgs have a website
  popupHTML = popupHTML.replace(
    "{initiative.www}",
    initiative.www && !dotcoop
    ? '<a class="fa fa-link" target="_blank" href="' +
      initiative.www +
      '" target="_blank" ></a>'
                  : ""
  );

  return popupHTML;
};

var pub = {
  getPopup: getPopup
};
module.exports = pub;
