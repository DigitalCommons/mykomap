/**
 *
 * The purpose of this module is to insulate the rest of the application from
 * changes made to the format of config_json, version_json, etc.
 *
 * It returns an object with accessor methods for obtaining configured data.
 */


define([], function() {
  "use strict";

  /** Define config value types, and certain helper functions.
   *
   * parseString should accept a string and return a parsed value
   * suitable for the config item of associated type.
   */
  const types = {
    boolean: {
      // Parse '', 'false', or 'no' as false, everything else as true.
      parseString: (val) => {
        switch(val.toLowerCase()) {
        case '':
        case 'false':
        case 'no':
          return false;
        default:
          return true;        
        }
      },
    },
    string: {
      // No-op
      parseString: (val) => val,
    },
    latLng:  {
      // Parse as a list of 2 comma-delimited numbers.
      // Like: "<latitude>,<longitude>"
      // Drop trailing numbers
      parseString: (val) =>
        val.split(',', 2).map(s => isNaN(s)? 0 : Number(s)),
    },
    latLng2:  {
      // Parse as a list of 4 comma-delimited numbers.
      // Like: "<latitude1>,<longitude1>,<latitude2>,<longitude2>"
      // Drop trailing numbers
      parseString: (val) => {
        const e = val.split(',', 4).map(s => isNaN(s)? 0 : Number(s));
        return [[e[0],e[1]],[e[2],e[3]]];
      },
    },
    arrayOfString:  {
      // Parse as comma-delimited values.
      // NB doesn't handle escaping, so no ',' possible in strings
      // Spaces are considered significant - they are not trimmed.
      parseString: (val) => val.split(/,/),
    },
  };
  
  /* Define the config schema using a list of field meta-data, from
   * which we construct the object. This allows a lot of flexibility
   * and introspection.
   *
   * Schema fields:

   * id: A unique identifier to be used in config object attributes,
   * amongst other places.
   *
   * descr: A brief description.
   *
   * init: An optional function to call to initialise the default
   * value. Otherwise it is unset.
   *
   * getter: Optionally a string naming the value getter method, or a
   * method function to call to get it (in which `this` is the config
   * object). If one is defined, the name of the function will be used
   * as the name of the getter. If this value is unset, the getter
   * method has the same name as the id.
   */
  const configSchema = ({
    aboutHtml, variant, timestamp, gitcommit, namedDatasets,
    htmlTitle, defaultNongeoLatLng, initialBounds, filterableFields,
    doesDirectoryHaveColours, disableClusteringAtZoom
  } = {}) => [
    { id: 'aboutHtml',
      descr: `Raw HTML definition of the map's "about" text`,
      init: () => aboutHtml,
    },
    { id: 'servicesPath',
      descr: 'Preset location of the data source script(s)',
      init: () => 'services/',
      getter: 'getServicesPath',
    },
    { id: 'variant',
      descr: 'The name of the variant used to generate this map application',
      init: () => variant,
      getter: 'getSoftwareVariant',
    },
    { id: 'timestamp',
      descr: 'A timestamp indicating when this application was deployed',
      init: () => timestamp,
      getter: 'getSoftwareTimestamp',
    },
    { id: 'gitcommit',
      descr: 'The git commit-ID of the sea-map source code deployed',
      init: () => gitcommit,
      getter: 'getSoftwareGitCommit',
    },
    { id: 'namedDatasets',
      descr: 'These names correspond to directories in www/services which contain '+
      'default-graph-uri.txt, endpoint.txt, query.rq',
      init: () => namedDatasets,
    },
    { id: 'htmlTitle',
      descr: `If set, this will override the default value for the map's HTML <title> tag`,
      init: () => htmlTitle,
      setter: 'setHtmlTitle',
      type: types.string,
    },
    { id: 'defaultNongeoLatLng',
      descr: 'The default latitude and longitude values (as a '+
      '`{lat: <string>, lng: <string>}` object) for initiatives with no address; '+
      'defaults to `{lat: undefined, lng: undefined}`',
      init: () => defaultNongeoLatLng,
      getter: function getNongeoLatLng() {
        return this.defaultNongeoLatLng?
          this.defaultNongeoLatLng  : { lat: undefined, lng: undefined };
      },
      setter: 'setDefaultNongeoLatLng',
      type: types.latLng,
    },
    { id: 'initialBounds',
      descr: 'The initial bounds of the map as an array: [[n1,e1],[n2,e2]]; '+
      'these are chosen automatically if this is unset',
      init: () => initialBounds,
      getter: 'getInitialBounds',
      setter: 'setInitialBounds',
      type: types.latLng2,
    },
    { id: 'filterableFields',
      descr: 'Defines the fields that can populate the directory',
      init: () => filterableFields,
      getter: 'getFilterableFields',
      setter: 'setFilterableFields',
      type: types.arrayOfString,
    },
    { id: 'doesDirectoryHaveColours',
      descr: 'True if the directory should feature coloured entries',
      init: () => doesDirectoryHaveColours,
      setter: 'setDirectoryHasColours',
      type: types.boolean,
    },
    { id: 'disableClusteringAtZoom',
      descr: 'Defines the zoom level to stop clustering at (an integer; or false for off)',
      init: () => disableClusteringAtZoom,
      getter: 'getDisableClusteringAtZoom',
      setter: 'setDisableClusteringAtZoom',
      type: types.boolean,
    },
  ];

  return configSchema;
});
