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


import type {
  Dictionary,
  Point2d,
  Box2d
} from '../../common_types';

import type {
  DataServices,
  Initiative,
  PropDef,
  PropDefs,
  FieldDefs,
} from './dataservices';

import type {
  ObjTransformFunc,
} from '../../obj-transformer';

import type {
  InitiativeObj,
} from './dataservices';

class TypeDef<T> {
  constructor(params: {
    name: string;
    parseString?: TypeDef<T>['parseString'];
    descr?: string;
    stringDescr?: TypeDef<T>['stringDescr']}) {
    this.name = params.name;
    this.parseString = params.parseString;
    this.descr = params.descr || '';
    this.stringDescr = params.stringDescr;
  }
  // The type's short JSDoc style identifier, e.g. {int} or {MyType[]}
  name: string;
  // The type's description
  descr: string;
  // An explanation of the expected input when parsing a string
  stringDescr?: string;
  // A string-parsing function
  parseString?: (val: string) => T;
};


export interface VocabSource {
  id: string;
  type: string;
  label: string;
}

export interface HostSparqlVocabParams {
  endpoint: string;
  defaultGraphUri?: string;
  uris: Record<string, string>;
}  

export interface HostSparqlVocabSource extends VocabSource, HostSparqlVocabParams {
  type: 'hostSparql';
}

export interface JsonVocabSource extends VocabSource {
  type: 'json';
  url: string;
}

export type AnyVocabSource = HostSparqlVocabSource | JsonVocabSource;

export interface DataSource {
  id: string;
  type: string;
  label: string;
};

export interface HostSparqlDataSource extends DataSource {
  type: 'hostSparql';
}


type Row = Record<string, string|null|undefined>;
type CsvTransformerFunc = ObjTransformFunc<Row, InitiativeObj>;

export interface CsvDataSource extends DataSource {
  type: 'csv';
  url: string;
  transform: CsvTransformerFunc;
}

export type AnyDataSource = HostSparqlDataSource | CsvDataSource;

export type ConfigTypes = string|string[]|number|boolean|DialogueSize|Point2d|Box2d|AnyVocabSource[]|AnyDataSource[];
export type TypeDefs = { readonly [key: string]: TypeDef<ConfigTypes> }

export interface ReadableConfig {
  aboutHtml(): string;
  attr_namespace(): string;
  doesDirectoryHaveColours(): boolean;
  elem_id(): string;
  fields(): FieldDefs;
  getCustomPopup(): InitiativeRenderFunction | undefined;
  getDataSources(): AnyDataSource[];
  getDefaultLatLng(): Point2d;
  getDefaultOpenSidebar(): boolean;
  getDialogueSize(): DialogueSize;
  getDisableClusteringAtZoom(): number;
  getFilterableFields(): string[];
  getInitialBounds(): Box2d | undefined;
  getLanguage(): string;
  getLanguages(): string[];
  getMapAttribution(): string;
  getMaxZoomOnGroup(): number;
  getMaxZoomOnOne(): number;
  getMaxZoomOnSearch(): number;
  getNoLodCache(): boolean;
  getSearchedFields(): string[];
  getServicesPath(): string;
  getShowAboutPanel(): boolean;
  getShowDatasetsPanel(): boolean;
  getShowDirectoryPanel(): boolean;
  getShowSearchPanel(): boolean;
  getSidebarButtonColour(): string;
  getSoftwareGitCommit(): string;
  getSoftwareTimestamp(): string;
  getSoftwareVariant(): string;
  getTileUrl(): string | undefined;
  getVersionTag(): string;
  htmlTitle(): string;
  logo(): string | undefined;
  vocabularies(): AnyVocabSource[];
};

export interface WritableConfig {
  setDefaultLatLng(val: Point2d): void;
  setDialogueSize(val: DialogueSize): void;
  setDirectoryHasColours(val: boolean): void;
  setDisableClusteringAtZoom(cal: number): void;
  setFilterableFields(val: string[]): void;
  setHtmlTitle(val: string): void;
  setInitialBounds(val: Box2d | undefined): void;
  setLanguage(val: string): void;
  setLogo(val: string): void;
  setMaxZoomOnGroup(val: number): void;
  setMaxZoomOnOne(val: number): void;
  setMaxZoomOnSearch(val: number): void;
  setNoLodCache(val: boolean): void;
  setSearchedFields(val: string[]): void;
  setShowAboutPanel(val: boolean): void;
  setShowDatasetsPanel(val: boolean): void;
  setShowDirectoryPanel(val: boolean): void;
  setShowSearchPanel(val: boolean): void;
};

export interface ConfigSchema<T> {
  // An identifier string
  id: keyof ConfigData;
  // A short description of the config value
  descr: string;
  // Indicates the default used if not explicitly defined
  defaultDescr?: string;
  // An mandatory getter name
  getter: keyof ReadableConfig;
  // An optional setter name, there will be no setter if this is undefined
  setter?: keyof WritableConfig;
  // A type definition
  type: TypeDef<T>;
}

export interface DialogueSize {
    width?: string;
    height?: string;
    descriptionRatio?: number;
};  

export type InitiativeRenderFunction =
  (initiative: Initiative, model: DataServices) => string;

export class ConfigData {
  aboutHtml: string = '';
  attr_namespace: string = '';
  customPopup?: InitiativeRenderFunction;
  dataSources: AnyDataSource[] = [{
    id: 'default',
    type: 'hostSparql',
    label: 'Default Set',
  }];
  defaultLatLng: Point2d = [0, 0];
  defaultOpenSidebar: boolean = false;
  dialogueSize: DialogueSize = {
    "width": "35vw",
    "height": "225px",
    "descriptionRatio": 2.5,
  };
  disableClusteringAtZoom: number = 0;
  doesDirectoryHaveColours: boolean = false;
  elem_id: string = 'map-app';
  fields: Dictionary<PropDef | PropDef['type']> = {};
  filterableFields: string[] = [];
  gitcommit: string = '0';
  htmlTitle: string = '';
  initialBounds?: Box2d;
  language: string = 'EN';
  languages: string[] = ['EN'];
  logo?: string;
  mapAttribution: string = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
    'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> ' +
    '| Powered by <a href="https://www.geoapify.com/">Geoapify</a>';
  maxZoomOnGroup: number = 18;
  maxZoomOnOne: number = 18;
  maxZoomOnSearch: number = 18;
  noLodCache: boolean = true;
  mykoMapVersion: string = '0';
  searchedFields: string[] = ['name'];
  servicesPath: string = 'services/';
  showAboutPanel: boolean = true;
  showDatasetsPanel: boolean = true;
  showDirectoryPanel: boolean = true;
  showSearchPanel: boolean = true;
  sidebarButtonColour: string = '#39cccc';
  tileUrl?: string;
  timestamp: string = '2000-01-01T00:00:00.000Z';
  variant: string = '';
  vocabularies: AnyVocabSource[] = [];
  
  // This index accessor is required for Typescript to allow dynamic assignment, it seems
  [name: string]: unknown;

  constructor(params: Partial<ConfigData> = {}) {
    Object.assign(this, params);
  }
};

// This type is constrained to have the same keys as ConfigData, and
// values which are ConfigSchema of the appropriate type for the
// ConfigData property in question.
export type ConfigSchemas = { [K in keyof ConfigData]: ConfigSchema<ConfigData[K]> };


// Validates/normalises a language code.
// This is defined here as it is used more than once.
function validateLang(lang: any): string {
  if (typeof lang !== 'string' || lang.match(/[^\w -]/))
    throw new Error(`rejecting suspect language code '${lang}'`);
  return lang.trim().toUpperCase();
}

// Returns the normalised language
// This is `lang` (uppercased) if it is valid and one of those in `langs`,
// else the first element of `langs` is returned.
function normLanguage(lang: any, langs: string[]): string {
  let normLang = validateLang(lang);
  if (!langs.includes(normLang)) {
    // Warn about this, presumably this has been defined wrongly, and attempt to recover
    normLang = langs[0];
    console.warn(`the language being set (${lang}) is unsupported, must be one of:`,
                 `${langs.join(", ")}. Falling back to ${normLang}`);
  }
  return normLang;
}
/** Define config value types, and certain helper functions.
 *
 * Type 'name' should be a JSDoc description:
 * https://jsdoc.app/tags-type.html
 *
 * Additional information in 'descr', or 'stringDescr' for how
 * strings get parsed. These are optional.
 *
 * parseString, if present, should accept a string and return a parsed value
 * suitable for the config item of associated type.
 *
 * Note: types is deliberately not defined as a map to
 * Type<ConfigTypes>, because Typescript can't seem to narrow the
 * union ConfigTypes to a specific member type when I do. Seems
 * related to: https://github.com/microsoft/TypeScript/issues/24085
 * and/or https://github.com/microsoft/TypeScript/issues/27808
 */
const types = {
  int: new TypeDef<number>({
    name: '{number}',
    parseString: (val: string) => Number(val),
  }),
  boolean: new TypeDef<boolean>({
    name: '{boolean}',
    stringDescr: "The empty string, 'false', or 'no' parse as `false`, " +
      "everything else as `true`.",
    parseString: (val: string) => {
      switch (val.toLowerCase()) {
        case '':
        case 'false':
        case 'no':
          return false;
        default:
          return true;
      }
    },
  }),
  string: new TypeDef<string>({
    name: '{string}',
    // No-op
    parseString: (val: string) => val,
  }),
  latLng: new TypeDef<Point2d>({
    name: '{Point2d}',
    descr: 'A two-element array defining latitude and longitude in degrees.',
    stringDescr: 'A comma-delimited list of two numbers defining latitude ' +
      'and longitude in degrees.',
    parseString: (val: string): Point2d => {
	    if (val) {
        const vals = val
          .split(',')
          .map(Number)
          .map(s => isNaN(s) ? 0 : s);
        if (vals.length != 2)
          throw new Error(`latLng must have two components, not ${vals.length}: ${val}`);
        return [vals[0], vals[1]];
      }
      return [0, 0];
    },
  }),
  latLng2: new TypeDef<Box2d | undefined>({
    name: '{Box2d}',
    descr: '[[latitude, longitude],[latitude, longitude]] - ' +
           'A two-element array of two-element arrays of numbers, ' +
           'defining two pairs of latitude and longitudes in degrees. May be undefined.',
    stringDescr: 'A comma-delimited list of four numbers defining two latitude ' +
                 'and longitude pairs, in degrees.',
    parseString: (val: string) => {
      const e = val
        .split(',', 4)
        .map(Number)
        .map(s => isNaN(s) ? 0 : s);
      return [[e[0], e[1]], [e[2], e[3]]];
    },
  }),
  arrayOfString: new TypeDef<string[]>({
    name: '{string[]}',
    descr: 'An array of strings.',
    stringDescr: 'A comma-delimited list of strings. No escaping is used, ' +
                 "so no commas can exist in the strings. Spaces are not trimmed.",
    parseString: (val: string) => val.split(/,/),
  }),
  dialogueSize: new TypeDef<DialogueSize>({
    name: '{DialogueSize}',
    descr: 'An object containing only string values.',
    stringDescr: 'A comma-delimited list of name-value pairs, each delimited by a colon. '+
                 'Therefore no commas or colons can exist in either names or values. '+
                 'Spaces are not trimmed, and later key duplicates will overwrite earlier ones.',
    parseString: (val: string): DialogueSize => {
      const obj = Object.fromEntries(val.split(/,/).map(el => el.split(/:/, 2)));
      return {
        width: String(obj.width),
        height: String(obj.height),
        descriptionRatio: Number(obj.descriptionRatio) 
      };
    },
  }),
  propDefs: new TypeDef<Dictionary<PropDef | PropDef['type']>>({
    name: '{PropDefs}',
    descr: 'A dictionary of initiative property definitions, or just a property type string, '+
      'keyed by property id',
  }),
  initiativeRenderFunction: new TypeDef<InitiativeRenderFunction>({
    name: '{InitiativeRenderFunction}',
    descr: 'A function which accepts an Initiative instance and returns an HTML string',
  }),
  vocabSources: new TypeDef<AnyVocabSource[]>({
    name: '{AnyVocabSource[]}',
    descr: 'An array of vocab source definitions, defining a SPARQL endpoint URL, '+
      'a default graph URI, and an index of vocabulary URIs to their prefixes - '+
      'which must be unique to the whole array.',
  }),
  dataSources: new TypeDef<AnyDataSource[]>({
    name: '{AnyDataSource[]}',
    descr: 'An array of data source definitions, defining the type, ID, and in certain cases '+
      'other source-secific parameters needed for the source type',  
  }),
};



/* FIXME relocate
 * Define the config schema using a list of field meta-data, from
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
 * setter: Optionally a string naming the value setter method, or a
 * method function to call to get it (in which `this` is the config
 * object).
 * 
 * If one is defined, the name of the function will be used
 * as the name of the getter. The new value will be passed as the only
 * parameter, but the function's `this` context will be set to the current
 * config object, and the appropriate setting(s) should be modified directly.
 * The return value is not used.
 * 
 * If the setter is left unset, then the value cannot
 * be modified after initialisation, either in code or externally.
 *
 * getter: Optionally a string naming the value getter method, or a
 * method function to call to get it (in which `this` is the config
 * object). If one is defined, the name of the function will be used
 * as the name of the getter. If this value is unset, the getter
 * method has the same name as the id.
 *
 * Note, the schema is initialised via a function call. The parameters to this
 * should match the configuration attributes, and can be used to initialise
 * these attributes from an external source, if supplied by the caller
 * when requiring mykomap.
 *
 * Therefore, the default value of the parameters below will (typically) 
 * define the default value to use when the user does not supply one (unless
 * the initialiser function ignores it and selects something else.)
 *
 * If defaultDescr is defined, this is used as a documentation of the default value,
 * else the value itself is quoted.
 */
//export const configSchema: ConfigSchemaInit & { doc?: () => string } = () => {
export class Config implements ReadableConfig, WritableConfig {
  
  private readonly data: ConfigData;
  private readonly configSchemas: ConfigSchemas;
  private _fields: PropDefs;

  private stringsToPropDefs(fields: ConfigData['fields']): PropDefs {
    const propDefEntries = Object.entries(fields ?? {}).map(
      ([id, field]) => {
        if (typeof field === 'string')
          return [id, { type: field, from: id }];
        return [id, field];
      }
    );
    return Object.fromEntries(propDefEntries);
  }
  
  constructor(config: Partial<ConfigData> = new ConfigData()) {
    const defaultConfig = new ConfigData();
    this.data = { ...defaultConfig, ...config };
    this.configSchemas = {
      aboutHtml: {
        id: 'aboutHtml',
        descr: `Raw HTML definition of the map's "about" text. This can be internationalised `+
          'in the following way: any elements with a `lang` tag which does not match the '+
          'current language (which is set by default to `EN`) are removed, along with all '+
          'child elements. Elements with no `lang` tag will be left in whatever the '+
          'language, so by default older single-language definitions will still '+
          'work as they did. Note however that the about text is always followed by links '+
          'to the data and docs now, so you should no longer link to this in the about text.',
        defaultDescr: "The contents of the consuming project's file `config/about.html`",
        getter: 'aboutHtml',
        type: types.string,
      },
      attr_namespace: {
        id: 'attr_namespace',
        descr: "Sets the namespace prefix expected on the mykomap anchor element's attributes.",
        getter: 'attr_namespace',
        type: types.string,
      },
      customPopup: {
        id: 'customPopup',
        descr: "An optional function accepting an Initiative and an DataServices object, "+
          "which returns an HTML string which will be used as the pop-up contents for that "+
          "initiative's marker",
        getter: 'getCustomPopup',
        type: types.initiativeRenderFunction,
      },
      dataSources: {
        id: 'dataSources',
        descr: 'A list of data-source definitions',
        getter: 'getDataSources',
        type: types.dataSources,
      },
      defaultLatLng: {
        id: 'defaultLatLng',
        descr: 'The position on the map that an initiative\'s dialog is positioned if it ' +
          'has no resolvable geolocation, as an array: [lat,lon]; these are set to [0,0] if it is unset.',
        getter: 'getDefaultLatLng',
        setter: 'setDefaultLatLng',
        type: types.latLng,
      },
      defaultOpenSidebar: {
        id: 'defaultOpenSidebar',
        descr: 'Set whether the sidebar is by default open on starting the app.',
        getter: 'getDefaultOpenSidebar',
        type: types.boolean,
      },
      dialogueSize: {
        id: 'dialogueSize',
        descr: 'Set the dimensions of the dialogue box. Height and width are raw css values ' + 
          'descriptionRatio is how many times larger the description section is than the ' +
          'contact section. These values are used in view/map.js',
        defaultDescr: "```\n"+JSON.stringify(defaultConfig.dialogueSize, null, 2)+"\n```",
        getter: 'getDialogueSize',
        setter: 'setDialogueSize',
        type: types.dialogueSize,
      },
      disableClusteringAtZoom: {
        id: 'disableClusteringAtZoom',
        descr: ['Defines the zoom level above which to cluster pins;',
                'passed to Leaflet.markercluster plugin.',
                'Zero effectively disables clustering, as this is a fully zoomed-out, global map;',
                'most maps zoom in to level 18.',
                'If omitted, clustering is always off. ',
                'See: https://leaflet.github.io/Leaflet.markercluster/#other-options',
                'and https://leafletjs.com/examples/zoom-levels/'].join(' '),
        getter: 'getDisableClusteringAtZoom',
        setter: 'setDisableClusteringAtZoom',
        type: types.int,
      },
      doesDirectoryHaveColours: {
        id: 'doesDirectoryHaveColours',
        descr: 'True if the directory should feature coloured entries',
        getter: 'doesDirectoryHaveColours',
        setter: 'setDirectoryHasColours',
        type: types.boolean,
      },
      elem_id: {
        id: 'elem_id',
        descr: '',
        getter: 'elem_id',
        type: types.string,
      },
      fields: {
        id: 'fields',
        descr: 'Defines extended definitions of new or existing initiative fields',
        getter: 'fields',
        type: types.propDefs,
      },
      filterableFields: {
        id: 'filterableFields',
        descr: 'Defines the instance properties that can populate the directory. Must be '+
          'a list of instance property names which are associated with vocabularies.',
        getter: 'getFilterableFields',
        setter: 'setFilterableFields',
        type: types.arrayOfString,
      },
      gitcommit: {
        id: 'gitcommit',
        descr: 'The git commit-ID of the mykomap source code deployed.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        getter: 'getSoftwareGitCommit',
        type: types.string,
      },
      htmlTitle: {
        id: 'htmlTitle',
        descr: `If set, this will override the default value for the map's HTML <title> tag.`,
        getter: 'htmlTitle',
        setter: 'setHtmlTitle',
        type: types.string,
      },
      initialBounds: {
        id: 'initialBounds',
        descr: 'The initial bounds of the map as an array: [[n1,e1],[n2,e2]]; ' +
          'these are chosen automatically if this is unset',
        getter: 'getInitialBounds',
        setter: 'setInitialBounds',
        type: types.latLng2,
      },
      language: {
        id: 'language',
        descr: 'The language to use for internationalised text. Must be one of those listed in '+
          '`languages`, or it will be set to the first language code in `languages`. '+
          'Will be upcased if not already.',
        getter: 'getLanguage',
        setter: 'setLanguage',
        type: types.string,
      },
      languages: {
        id: 'languages',
        descr: 'An array of supported languages which can be used for internationalised text. '+
          'Should not be empty, and all codes should be upper case. '+
          'Any other language code used will be replaced with the first in this list. '+
          'A phrases for the first code will also used as a fallback if an individual '+
          'phrase is missing.',
        defaultDescr: "```\n"+JSON.stringify(defaultConfig.languages, null, 2)+"\n```",
        getter: 'getLanguages',
        type: types.arrayOfString,
      },
      logo: {
        id: 'logo',
        descr: `If set this will display the logo of the organisation. This takes in a link to a logo image loaded into an HTML <image>`,
        getter: 'logo',
        setter: 'setLogo',
        type: types.string, // FIXME maybeString?  check other maybes
      },
      mapAttribution: {
        id: 'mapAttribution',
        descr: 'the attribution message to put at the bottom of the map',
        getter: 'getMapAttribution',
        type: types.string,
      },
      maxZoomOnGroup: {
        id: 'maxZoomOnGroup',
        descr: 'The maximum zoom in that can happen when selecting any particular group in directory, if 0 does no zooming. Defaults to 18 and auto decides best max zoom',
        getter: 'getMaxZoomOnGroup',
        setter: 'setMaxZoomOnGroup',
        type: types.int,
      },
      maxZoomOnOne: {
        id: 'maxZoomOnOne',
        descr: 'The maximum zoom in that can happen when selecting an initiative, if 0 does no zooming. Defaults to 18 and auto decides best max zoom',
        getter: 'getMaxZoomOnOne',
        setter: 'setMaxZoomOnOne',
        type: types.int,
      },
      maxZoomOnSearch: {
        id: 'maxZoomOnSearch',
        descr: 'The maximum zoom in that can happen when searching any particular group, if 0 does no zooming. Defaults to 18 and auto decides best max zoom',
        getter: 'getMaxZoomOnSearch',
        setter: 'setMaxZoomOnSearch',
        type: types.int,
      },
      noLodCache: {
        id: 'noLodCache',
        descr: `Responses to SPARQL queries will normally be cached in /services/locCache.txt `+
          `if this option is false or absent, with the aim of speeding up map loading time.`+
          `The cache file is only updated if the static linked data's top-level index.rdf `+
          `file is newer than the cache's timestamp. But if this option is set to true, `+
          `this cache is disabled and a query is made each time the map is loaded.`,
        defaultDescr: "True",
        getter: 'getNoLodCache',
        setter: 'setNoLodCache',
        type: types.boolean,
      },
      mykoMapVersion: {
        id: 'mykoMapVersion',
        descr: 'The git tag of the mykomap source code deployed.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        getter: 'getVersionTag',
        type: types.string,
      },
      searchedFields: {
        id: 'searchedFields',
        descr: "A list of fields that are looked at when using the search function. Valid "+
          "values for this parameter are 'name', 'uri', and any custom field names supplied "+
          "in the configuration." +
          "\nIf non-valid values are passed, the app will fail silently (no errors will be produced)" +
          "\nThe default values are 'name'" +
          "\nUsers can pass single arguments and multiple arguments, separated with a comma" +
          "\nPassing multiple values example: https://dev.ica.solidarityeconomy.coop/?searchedFields=regorg,otherActivities" +
          "\nPassing a single value example: https://dev.ica.solidarityeconomy.coop/?searchedFields=regorg" +
          "\n\nThe search functionality works by creating a 'searchstr' string parameter for every initiative," +
          "this is populated using the values from the fields of the initiative (only the fields specified in the 'searchedFields' parameter are used)" +
          "\nCurrently the field values added to the 'searchstr' parameter are concatenated (without spacing) to each other." +
          "\nThe 'searchstr' is then converted into uppercase. No other string transformations are currently applied" +
          "\nWhen a user uses the mykomap search the entered text will be converted into uppercase as well. If the searched text is included anywhere in the 'searchstr' value, the initiative is added to the results.",
        getter: 'getSearchedFields',
        setter: 'setSearchedFields',
        type: types.arrayOfString,
      },
      servicesPath: {
        id: 'servicesPath',
        descr: 'Preset location of the data source script(s).',
        getter: 'getServicesPath',
        type: types.string,
      },
      showAboutPanel: {
        id: 'showAboutPanel',
        descr: `If true this will load the datasets panel`,
        getter: 'getShowAboutPanel',
        setter: 'setShowAboutPanel',
        type: types.boolean,
      },
      showDatasetsPanel: {
        id: 'showDatasetsPanel',
        descr: `If true this will load the datasets panel`,
        getter: 'getShowDatasetsPanel',
        setter: 'setShowDatasetsPanel',
        type: types.boolean,
      },
      showDirectoryPanel: {
        id: 'showDirectoryPanel',
        descr: `If true this will load the datasets panel`,
        getter: 'getShowDirectoryPanel',
        setter: 'setShowDirectoryPanel',
        type: types.boolean,
      },
      showSearchPanel: {
        id: 'showSearchPanel',
        descr: `If true this will load the datasets panel`,
        getter: 'getShowSearchPanel',
        setter: 'setShowSearchPanel',
        type: types.boolean,
      },
      sidebarButtonColour: {
        id: "sidebarButtonColour",
        descr: 'Set the css background-colour attribute for the open sidebar button. Defaults to teal',
        getter: 'getSidebarButtonColour',
        type: types.string
      },
      tileUrl: {
        id: 'tileUrl',
        descr: 'the tile map url',
        defaultDescr: "uses the OSM standard tile maps if nothing is provided",
        getter: 'getTileUrl',
        type: types.string,
      },
      timestamp: {
        id: 'timestamp',
        descr: 'A timestamp string indicating when this application was deployed.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        getter: 'getSoftwareTimestamp',
        type: types.string,
      },
      variant: {
        id: 'variant',
        descr: 'The name of the variant used to generate this map application.',
        defaultDescr: "Defined by `variant` attribute of the consuming project's " +
          "file `config/version.json`",
        getter: 'getSoftwareVariant',
        type: types.string,
      },
      vocabularies: {
        id: 'vocabularies',
        descr: 'Specifies the vocabularies to obtain via SPARQL query for use in `fields`',
        defaultDescr: 'No vocabs are queried if nothing is provided',
        getter: 'vocabularies',
        type: types.vocabSources,
      },
      //  [name: string]: unknown;
    };

    // Some validation / defaults
    this.data.language = normLanguage(this.data.language ?? this.data.languages[0], ['EN']);
    if (this.data.languages.length === 0)
      throw new Error("languages is configured empty, this should not happen");
    this.data.languages = this.data.languages.map(validateLang);
    
    // Expand abbreviated field defs
    this._fields = this.stringsToPropDefs(this.data.fields);
    
    // Special know-how validations...
    
    // Make sure the vocab prefixes are unique
    const prefixesSeen = {} as Dictionary;
    const urisSeen = {} as Dictionary;
    if (this.data.vocabularies) {
      for(let ix = 0; ix < this.data.vocabularies.length; ix++) {
        const vocabSource: AnyVocabSource = this.data.vocabularies[ix];
        switch(vocabSource.type) {
          case 'hostSparql':
            Object.entries(vocabSource.uris).forEach(([vocabUri, vocabPrefix]) => {
              if (vocabPrefix === undefined)
                return;
              if (vocabPrefix in prefixesSeen) {
                console.warn(`Duplicate prefix in vocabularies config, ${vocabPrefix} (for ${vocabUri})`);
              }
              else {
                prefixesSeen[vocabPrefix] = vocabUri;
                urisSeen[vocabUri] = vocabPrefix;
              }          
            })
            break;
          case 'json':
            // We don't know what vocab URIs are included until after
            // loading, so can't check these
            break;
        }
      }
    }

    // Make sure the fields all reference a known vocab
    /* FIXME this no longer works - can we check it later?
    for(const fieldId in this._fields ?? {}) {
      let field = this._fields[fieldId];
      if (field === undefined)
        continue;
      if (field.type === 'multi')
        field = field.of;
      if (field.type !== 'vocab')
        continue;

      let vocabUri = field.uri;
      if (vocabUri.endsWith(':')) {
        vocabUri = vocabUri.slice(0, -1);
        if (!prefixesSeen[vocabUri]) {
          throw new Error(`Unknown vocab prefix '${vocabUri}' in field '${fieldId}'`);
        }
      }
      else {
        if (!urisSeen[vocabUri]) {
          const error = new Error(`Unknown vocab uri '${vocabUri}' in field '${fieldId}'`);
          if (!vocabUri.includes(':'))
            error.message += ` (did you omit the trailing colon for a prefix?)`;
          throw error;
        }
      }
    }*/ 
  }

  // This generates the documentation for this schema, in Markdown
  generateDoc(): string {
    return [`
# \`config.json\`

This describes the schema of the \`config.json\` file consuming projects should supply,
and valid attributes thereof. It should be an object definition. Valid attributes are
described here. Valid attributes which are not defined in \`config.json\` will take a
default value. Those which are not valid are ignored.

Here is an example of what you might put in this file:

\`\`\`
 {
  "htmlTitle": "Solidarity Oxford",
  "filterableFields": ["countryId", "primaryActivity"],
  "doesDirectoryHaveColours": true,
  "disableClusteringAtZoom": 10
}
\`\`\`

These values are defaults, however, which can be overridden in various ways,
as described in [README.md](README.md)

## Attributes

The following attributes can be defined.

`]
    // This maps each definition into s documentation section
    // FIXME not sure why we need to type cast
      .concat(Object.values(this.configSchemas)
              .sort((a, b) => (a.id as string).localeCompare(b.id as string))
              .map((def) => `
### \`${def.id}\`

- *type:* \`${def.type.name}\` ${def.type.descr || ''}
- *in string context:* ${def.type.stringDescr || 'parsed as-is'}
- *default:* ${def.defaultDescr || '`' + this.data[def.id] + '`'}
- *settable?:* ${def.setter ? 'yes' : 'no'}

${def.descr}



`))
      .join('');
  }

  add(strcfg: Dictionary) {
    console.info("add", strcfg);
    
    for(const id in strcfg) {
      const str = strcfg[id];
      if (!str)
        continue;
      if (id in this.configSchemas) {
        const def = this.configSchemas[id];
        
        if (def.setter && def.type.parseString) {
          const val = def.type.parseString(str);
          const setter = this[def.setter] as (val: any) => void; // FIXME this was frigged
          setter.call(this, val);
        }
        else {
          console.warn(`ignoring unsettable config item ${id}`);          
        }
      }
      else {
        console.warn(`ignoring invalid config item ${id}`);
      }
    }    
  }
  
  aboutHtml(): string {
    return this.data.aboutHtml;
  }

  attr_namespace(): string {
    return this.data.attr_namespace;
  }

  getCustomPopup(): InitiativeRenderFunction | undefined {
    return this.data.customPopup;
  }
  
  doesDirectoryHaveColours(): boolean {
    return this.data.doesDirectoryHaveColours;
  }
  
  elem_id(): string {
    return this.data.elem_id;
  }

  fields() {
    return this._fields;
  }

  getDataSources(): AnyDataSource[] {
    return this.data.dataSources;
  }
  
  getDefaultLatLng(): Point2d {
    return this.data.defaultLatLng;
  }
  
  getDefaultOpenSidebar(): boolean {
    return this.data.defaultOpenSidebar;
  }
  getDialogueSize(): DialogueSize {
    return this.data.dialogueSize;
  }
  getDisableClusteringAtZoom(): number {
    return this.data.disableClusteringAtZoom;
  }
  getFilterableFields(): string[] {
    return this.data.filterableFields;
  }
  getInitialBounds(): Box2d | undefined {
    return this.data.initialBounds;
  }
  getLanguage(): string {
    return this.data.language;
  }
  getLanguages(): string[] {
    return this.data.languages;
  }
  getMapAttribution(): string {
    return this.data.mapAttribution;
  }
  getMaxZoomOnGroup(): number {
    return this.data.maxZoomOnGroup;
  }
  getMaxZoomOnOne(): number {
    return this.data.maxZoomOnOne;
  }
  getMaxZoomOnSearch(): number {
    return this.data.maxZoomOnSearch;
  }
  getNoLodCache(): boolean {
    return this.data.noLodCache;
  }
  getSearchedFields(): string[] {
    return this.data.searchedFields;
  }
  getServicesPath(): string {
    return this.data.servicesPath;
  } 
  getShowAboutPanel(): boolean {
    return this.data.showAboutPanel;
  }
  getShowDatasetsPanel(): boolean {
    return this.data.showDatasetsPanel;
  }
  getShowDirectoryPanel(): boolean {
    return this.data.showDirectoryPanel;
  }
  getShowSearchPanel(): boolean {
    return this.data.showSearchPanel;
  }
  getSidebarButtonColour(): string {
    return this.data.sidebarButtonColour;
  }
  getSoftwareGitCommit(): string {
    return this.data.gitcommit;
  }
  getSoftwareTimestamp(): string {
    return this.data.timestamp;
  }
  getSoftwareVariant(): string {
    return this.data.variant;
  }
  getTileUrl(): string | undefined {
    return this.data.tileUrl;
  }
  getVersionTag(): string {
    return this.data.mykoMapVersion;
  }
  htmlTitle(): string {
    return this.data.htmlTitle;
  }
  logo(): string | undefined {
    return this.data.logo;
  }
  vocabularies(): AnyVocabSource[] {
    return this.data.vocabularies;
  }
  
  setDefaultLatLng(val: Point2d): void {
    this.data.defaultLatLng = val;
  }
  setDialogueSize(val: DialogueSize): void {
    this.data.dialogueSize = val;
  }
  setDirectoryHasColours(val: boolean): void {
    this.data.doesDirectoryHaveColours = val;
  }
  setDisableClusteringAtZoom(val: number): void {
    this.data.disableClusteringAtZoom = val;
  }
  setFilterableFields(val: string[]): void {
    this.data.filterableFields = val;
  }
  setHtmlTitle(val: string): void {
    this.data.htmlTitle = val;
  }
  setInitialBounds(val: Box2d): void {
    this.data.initialBounds = val;
  }
  setLanguage(val: string): void {
    this.data.language = normLanguage(val, this.data.languages);
  }
  setLogo(val: string): void {
    this.data.logo = val;
  }
  setMaxZoomOnGroup(val: number): void {
    this.data.maxZoomOnGroup = val;
  }
  setMaxZoomOnOne(val: number): void {
    this.data.maxZoomOnOne = val;
  }
  setMaxZoomOnSearch(val: number): void {
    this.data.maxZoomOnSearch = val;
  }
  setNoLodCache(val: boolean): void {
    this.data.noLodCache = val;
  }
  setSearchedFields(val: string[]): void {
    this.data.searchedFields = val;
  }
  setShowAboutPanel(val: boolean): void {
    this.data.showAboutPanel = val;
  }
  setShowDatasetsPanel(val: boolean): void {
    this.data.showDatasetsPanel = val;
  }
  setShowDirectoryPanel(val: boolean): void {
    this.data.showDirectoryPanel = val;
  }
  setShowSearchPanel(val: boolean): void {
    this.data.showSearchPanel = val;
  }
  
//  [id: string]: Getter | Setter;
};


