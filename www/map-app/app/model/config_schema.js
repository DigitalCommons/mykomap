/**
 *
 * The purpose of this module is to define the configuration parameters, in a self-documenting manner.
 *
 * It returns a function which accepts named values defining the
 * defaults for certain values which are obtained
 * programmatically in config.js.
 *
 * It is intended to be read by the script `generate-config-doc` to
 * generate a documentation file to commit as `CONFIG.md`. This is a
 * way of avoiding needing to duplicate the documentation manually in
 * more than one place, and possibly having them become inconsistent.
 *
 * REMEMBER TO REGENERATE CONFIG.md IF YOU ALTER THIS SCHEMA.
 */


define([], function () {
  "use strict";

  /** Define config value types, and certain helper functions.
   *
   * Type 'name' should be a JSDoc description:
   * https://jsdoc.app/tags-type.html
   *
   * Additional information in 'descr', or 'stringDescr' for how
   * strings get parsed. These are optional.
   *
   * parseString should accept a string and return a parsed value
   * suitable for the config item of associated type.
   */
  const types = {
    int: {
      name: '{number}',
      parseString: (val) => Number(val),
    },
    boolean: {
      name: '{boolean}',
      stringDesc: "The empty string, 'false', or 'no' parse as `false`, " +
        "everything else as `true`.",
      parseString: (val) => {
        switch (val.toLowerCase()) {
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
      name: '{string}',
      // No-op
      parseString: (val) => val,
    },
    latLng: {
      name: '{number[]}',
      descr: 'A two-element array defining latitude and longitude in degrees.',
      stringDescr: 'A comma-delimited list of two numbers defining latitude ' +
        'and longitude in degrees.',
      parseString: (val) => {
        return val ? val.split(',', 2).map(s => isNaN(s) ? 0 : Number(s)) : [0, 0];
      },
    },
    latLng2: {
      name: '{number[][]}',
      descr: '[[latitude, longitude],[latitude, longitude]] - ' +
        'A two-element array of two-element arrays of numbers, ' +
        'defining two pairs of latitude and longitudes in degrees',
      stringDescr: 'A comma-delimited list of four numbers defining two latitude ' +
        'and longitude pairs, in degrees.',
      parseString: (val) => {
        const e = val.split(',', 4).map(s => isNaN(s) ? 0 : Number(s));
        return [[e[0], e[1]], [e[2], e[3]]];
      },
    },
    arrayOfString: {
      name: '{string[]}',
      descr: 'An array of strings.',
      stringDescr: 'A comma-delimited list of strings. No escaping is used, ' +
        "so no commas can exist in the strings. Spaces are not trimmed.",
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
   *
   * Note, the schema is defined as a function accepting named values
   * to initialise certain of the attributes if they are not
   * present. These should all be supplied by config.js. If defaultDescr
   * is defined, this is used as a documentation of the default value,
   * else the value itself is quoted.
   */
  const configSchema = ({
    aboutHtml,
    variant,
    timestamp,
    gitcommit,
    seaMapVersion,
    namedDatasets,
    namedDatasetsVerbose,
    htmlTitle,
    initialBounds,
    defaultLatLng,
    filterableFields,
    doesDirectoryHaveColours,
    disableClusteringAtZoom,
    searchedFields,
    showDatasetsPanel,
    maxZoomOnGroup,
    maxZoomOnSearch,
    maxZoomOnOne,
    logo,
    tileUrl,
    mapAttribution,
  } = {}) => [
      {
        id: 'aboutHtml',
        descr: `Raw HTML definition of the map's "about" text.`,
        defaultDescr: "The contents of the consuming project's file `config/about.html`",
        init: () => aboutHtml,
        type: types.string,
      },
      {
        id: 'servicesPath',
        descr: 'Preset location of the data source script(s).',
        init: () => 'services/',
        getter: 'getServicesPath',
        type: types.string,
      },
      {
        id: 'variant',
        descr: 'The name of the variant used to generate this map application.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        init: () => variant,
        getter: 'getSoftwareVariant',
        type: types.string,
      },
      {
        id: 'timestamp',
        descr: 'A timestamp string indicating when this application was deployed.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        init: () => timestamp,
        getter: 'getSoftwareTimestamp',
        type: types.string,
      },
      {
        id: 'gitcommit',
        descr: 'The git commit-ID of the sea-map source code deployed.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        init: () => gitcommit,
        getter: 'getSoftwareGitCommit',
        type: types.string,
      },
      {
        id: 'seaMapVersion',
        descr: 'The git tag of the sea-map source code deployed.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        init: () => seaMapVersion,
        getter: 'getVersionTag',
        type: types.string,
      },
      {
        id: 'tileUrl',
        descr: 'the tile map url',
        defaultDescr: "uses the OSM standard tile maps if nothing is provided",
        init: () => tileUrl,
        getter: 'getTileUrl',
        type: types.string,
      },
      {
        id: 'mapAttribution',
        descr: 'the attribution message to put at the bottom of the map',
        init: () => (
          mapAttribution ||
          'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> '+
          'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> '+
          '| Powered by <a href="https://www.geoapify.com/">Geoapify</a>'
        ),
        getter: 'getMapAttribution',
        type: types.string,
      },
      {
        id: 'namedDatasets',
        descr: 'A list of names that correspond to directories in www/services, which must contain ' +
          'default-graph-uri.txt, endpoint.txt, query.rq.',
        init: () => namedDatasets,
        type: types.arrayOfString,
      },
      {
        id: 'namedDatasetsVerbose',
        descr: 'A list of names for the named datasets. Length must be exactly the same as namedDatasets' +
          ' or this will not be used',
        init: () => namedDatasetsVerbose,
        type: types.arrayOfString,
      },
      {
        id: 'htmlTitle',
        descr: `If set, this will override the default value for the map's HTML <title> tag.`,
        init: () => htmlTitle,
        setter: 'setHtmlTitle',
        type: types.string,
      },
      {
        id: 'showDatasetsPanel',
        descr: `If true this will load the datasets panel`,
        init: () => showDatasetsPanel == undefined ? true : showDatasetsPanel,
        getter: 'getShowDatasetsPanel',
        setter: 'setShowDatasetsPanel',
        type: types.boolean,
      },
      {
        id: 'initialBounds',
        descr: 'The initial bounds of the map as an array: [[n1,e1],[n2,e2]]; ' +
          'these are chosen automatically if this is unset',
        init: () => initialBounds,
        getter: 'getInitialBounds',
        setter: 'setInitialBounds',
        type: types.latLng2,
      },
      {
        id: 'defaultLatLng',
        descr: 'The position on the map that an initiative\'s dialog is positioned if it ' +
          'has no resolvable geolocation, as an array: [lat,lon]; these are set to [0,0] if it is unset.',
        init: () => defaultLatLng == undefined ? [0, 0] : defaultLatLng,
        getter: 'getDefaultLatLng',
        setter: 'setDefaultLatLng',
        type: types.latLng,
      },
      {
        id: 'filterableFields',
        descr: 'Defines the fields that can populate the directory',
        init: () => filterableFields,
        getter: 'getFilterableFields',
        setter: 'setFilterableFields',
        type: types.arrayOfString,
      },
      {
        id: 'doesDirectoryHaveColours',
        descr: 'True if the directory should feature coloured entries',
        init: () => doesDirectoryHaveColours,
        setter: 'setDirectoryHasColours',
        type: types.boolean,
      },
      {
        id: 'disableClusteringAtZoom',
        descr: ['Defines the zoom level above which to cluster pins;',
          'passed to Leaflet.markercluster plugin.',
          'Zero effectively disables clustering, as this is a fully zoomed-out, global map;',
          'most maps zoom in to level 18.',
          'If omitted, clustering is always off. ',
          'See: https://leaflet.github.io/Leaflet.markercluster/#other-options',
          'and https://leafletjs.com/examples/zoom-levels/'].join(' '),
        init: () => disableClusteringAtZoom,
        getter: 'getDisableClusteringAtZoom',
        setter: 'setDisableClusteringAtZoom',
        type: types.int,
      },
      {
        id: 'searchedFields',
        descr: 'A list of fields that are looked at when searching ' +
          ["name", "uri", "within", "lat", "lng", "www",
            "regorg", "sameas", "desc", "street", "locality",
            "region", "postcode", "country", "primaryActivity",
            "activity", "orgStructure", "tel", "email"].join(","),
        init: () => searchedFields == undefined ? ["name", "www"] : searchedFields,
        getter: 'getSearchedFields',
        setter: 'setSearchedFields',
        type: types.arrayOfString,
      },
      {
        id: 'maxZoomOnGroup',
        descr: 'The maximum zoom in that can happen when selecting any particular group in directory, if 0 does no zooming. Defaults to 18 and auto decides best max zoom',
        init: () => maxZoomOnGroup == undefined ? 18 : maxZoomOnGroup,
        getter: 'getMaxZoomOnGroup',
        setter: 'setMaxZoomOnGroup',
        type: types.int,
      },
      {
        id: 'maxZoomOnOne',
        descr: 'The maximum zoom in that can happen when selecting an initiative, if 0 does no zooming. Defaults to 18 and auto decides best max zoom',
        init: () => maxZoomOnOne == undefined ? 18 : maxZoomOnOne,
        getter: 'getMaxZoomOnOne',
        setter: 'setMaxZoomOnOne',
        type: types.int,
      },
      {
        id: 'maxZoomOnSearch',
        descr: 'The maximum zoom in that can happen when searching any particular group, if 0 does no zooming. Defaults to 18 and auto decides best max zoom',
        init: () => maxZoomOnSearch == undefined ? 18 : maxZoomOnSearch,
        getter: 'getMaxZoomOnSearch',
        setter: 'setMaxZoomOnSearch',
        type: types.int,
      },
      {
        id: 'logo',
        descr: `If set this will display the logo of the organisation. This takes in a link to a logo image loaded into an HTML <image>`,
        init: () => logo,
        setter: 'setLogo',
        type: types.string,
      }


    ];

  // This generates the documentation for this schema, in Markdown
  configSchema.doc = () => [`
# \`config.json\`

This describes the schema of the \`config.json\` file consuming projects should supply,
and valid attributes thereof. It should be an object definition. Valid attributes are
described here. Valid attributes which are not defined in \`config.json\` will take a
default value. Those which are not valid are ignored.

Here is an example of what you might put in this file:

\`\`\`
 {
  "namedDatasets": ["oxford"],
  "htmlTitle": "Solidarity Oxford",
  "filterableFields": [{ "field": "primaryActivity", "label": "Activities" }],
  "doesDirectoryHaveColours": true,
  "disableClusteringAtZoom": false
}
\`\`\`

These values are defaults, however, which can be overridden in various ways,
as described in [README.md](README.md)

## Attributes

The following attributes can be defined.

`]
    // This maps each definition into s documentation section
    .concat(configSchema().map((def) => `
### \`${def.id}\`

- *type:* \`${def.type.name}\` ${def.type.desc || ''}
- *in string context:* ${def.type.stringDescr || 'parsed as-is'}
- *default:* ${def.defaultDescr || '`' + def.init() + '`'}
- *settable?:* ${def.setter ? 'yes' : 'no'}

${def.descr}

${def.details || ''}

`))
    .join('');

  return configSchema;
});
