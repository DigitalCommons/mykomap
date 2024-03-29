
# `ConfigData`

This describes the schema of the `config` parameter which consuming
projects should supply to MykoMap via the `webRun(window: Window,
base_config: ConfigData): void` entry-point function, and valid attributes
thereof.

The config parameter should be a valid `ConfigData` class instance. If
TypeScript is used this will enforce the allowed attributes and their types
- this is recommended. In Javascript, it is merely an object - and you may 
get an error if an attribute defined here is given something unexpected.
However, attributes not listed here will simply be ignored.

The config parameter hard-wires some defaults for the application at the outset.
However, these can can still be overridden in various ways by URL
parameters or HTML element attributes in the web page, as described 
in [README.md](README.md)

The bare minimum config is the default `ConfigData` instance, which 
is essentially an empty object, but that would result in a totally empty map.

For the sake of illustration, here is an example of what you might put
in this parameter for a map with pins which have a `size`,
`description` and `address` properties, in addition of the hard-wired
bare minimum properties of `uri`, `name`, `lat` and `lng`. The
`size` field can be one of several pre-defined values - a taxonomy,
also known as a vocabulary.  Because of the presence of a `filter` 
attribute of `size`, there will be a single drop-down on the search 
panel for this narrowing the displayed pins by values of this field.

```
import { ConfigData } from  "mykomap/app/model/config-schema";
import { mkObjTransformer, DataVal } from "mykomap/obj-transformer";
import { InitiativeObj } from "mykomap/src/map-app/app/model/initiative";

const config: ConfigData = {
  htmlTitle: "Outlets",
  propDefs: { // the old name for this is 'fields', but deprecated
    address: 'value',
    size: {
      type: 'vocab',
      uri: 'sz:',
      filter: undefined,
    },
  },
  vocabularies: [
    {
      type: 'json',
      id: 'vocab',
      label: 'Vocabs 1.0',
      url: 'example.json',
    }
  ],
  dataSources: [
    {
      id: 'data',
      label: 'Data',
      type: 'csv',
      url: 'example.csv',
      transform: mkObjTransformer<DataVal, InitiativeObj>({
        uri: T.prefixed(baseUri).from('Identifier'),
        name: T.text('').from('Name'),
        lat: T.nullable.number(null).from('Latitude'),
        lng: T.nullable.number(null).from('Longitude'),
        description: T.text('').from('Description'),
        address: T.text('').from('Address'),
        size: T.prefixed('https://example.com/size/1.1/').from('Size'),
      }),
    },
  ],
}
```

This config would need to be accompanied with a `example.json` file
defining the vocabs, and a data file `example.csv`. Both of these
can be supplied in map project source code in the `www/` directory,
or an URL to elsewhere can be supplied. The `transform` attribute defines 
the mapping from CSV fields to map pin properties.

The vocabs file might look like this, which defines one vocabulary: size,
represented in the config by the abbreviated base URI `sz:`. The language 
isn't specified above, which means it defaults to English, hence there is only one
language section for `EN`, with term labels in English. For example:

```
{
  "prefixes": {
    "https://example.com/sizes/1.1/": "sz",
  },
  "vocabs": {
    "sz:": {
      "EN": {
        "title": ""
        "terms": {
          "sz:large": "Large",
          "sz:medium": "Medium",
          "sz:small": "Small",
        },
      },
    }
  }
}
```

The data file might look like this, which defines just three pins,
with some extra fields which are ignored in our example. Some
identifier field is mandatory, however.

```
Identifier,Name,Description,Address,Size,Latitude,Longitude,Geocoded Latitude,Geocoded Longitude
1,"Apple Co-op",We grow fruit.","1 Apple Way, Appleton",large,0,0,51.6084367,-3.6547778
2,"Banana Co","We straighten bananas.","1 Banana Boulevard, Skinningdale",medium,0,0,55.9646979,-3.1733052
3,"The Cabbage Collective","We are artists.","2 Cabbage Close, Caulfield",small,0,0,54.9744687,-1.6108945
```


## Attributes

The following attributes can be defined.


### `aboutHtml`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* The contents of the consuming project's file `config/about.html`
- *settable?:* no

Raw HTML definition of the map's "about" text. This can be internationalised in the following way: any elements with a `lang` tag which does not match the current language (which is set by default to `EN`) are removed, along with all child elements. Elements with no `lang` tag will be left in whatever the language, so by default older single-language definitions will still work as they did. Note however that the about text is always followed by links to the data and docs now, so you should no longer link to this in the about text.




### `attr_namespace`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* ``
- *settable?:* no

Sets the namespace prefix expected on the mykomap anchor element's attributes.




### `customPopup`

- *type:* `{InitiativeRenderFunction}` A function which accepts an Initiative instance and returns an HTML string
- *in string context:* parsed as-is
- *default:* `undefined`
- *settable?:* no

An optional function accepting an Initiative and an DataServices object, which returns an HTML string which will be used as the pop-up contents for that initiative's marker




### `dataSources`

- *type:* `{AnyDataSource[]}` An array of data source definitions, defining the type, ID, and in certain cases other source-secific parameters needed for the source type
- *in string context:* parsed as-is
- *default:* `[object Object]`
- *settable?:* no

A list of data-source definitions




### `defaultLatLng`

- *type:* `{Point2d}` A two-element array defining latitude and longitude in degrees.
- *in string context:* A comma-delimited list of two numbers defining latitude and longitude in degrees.
- *default:* `0,0`
- *settable?:* yes

The position on the map that an initiative's dialog is positioned if it has no resolvable geolocation, as an array: [lat,lon]; these are set to [0,0] if it is unset.




### `defaultOpenSidebar`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* `false`
- *settable?:* no

Set whether the sidebar is by default open on starting the app.




### `dialogueSize`

- *type:* `{DialogueSize}` An object containing only string values.
- *in string context:* When used in an URL, this is a comma-delimited list of name-value pairs, each delimited by a colon. For example, to set the width to 35% of the viewport width, and the height to 12% of the width, and the ratio of the description pane to the contact pane to be 2 to 1, use: `dialogueSize=width:35vw,height:12vw,descriptionRatio:2`. The `width` and `height` parameters are verbatim CSS distance values with units, defining the dialogue width and height. The default dialog has two halves separated vertically. The `descriptionRatio` parameter sets the number of times wider the left one (the description) should be to the right one (the contact details). Note: commas or colons are interpreted as delimiters, so do not put them in either names or values. Spaces are not trimmed. Parameter names besides those documented are ignored
- *default:* `{
  "width": "35vw",
  "height": "225px",
  "descriptionRatio": 2.5
}`
- *settable?:* yes

Set the dimensions of the dialogue box. Height and width are raw CSS values descriptionRatio is how many times larger the description section is than the contact section. These values are used in view/map.js




### `disableClusteringAtZoom`

- *type:* `{number}` 
- *in string context:* parsed as-is
- *default:* `0`
- *settable?:* yes

Defines the zoom level above which to cluster pins; passed to Leaflet.markercluster plugin. Zero effectively disables clustering, as this is a fully zoomed-out, global map; most maps zoom in to level 18. If omitted, clustering is always off.  See: https://leaflet.github.io/Leaflet.markercluster/#other-options and https://leafletjs.com/examples/zoom-levels/




### `doesDirectoryHaveColours`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* `false`
- *settable?:* yes

True if the directory should feature coloured entries




### `elem_id`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* `map-app`
- *settable?:* no






### `fields`

- *type:* `{PropDefs}` A dictionary of initiative property definitions, or just a property type string, keyed by property id
- *in string context:* parsed as-is
- *default:* `undefined`
- *settable?:* no

If present, defines extended definitions of extended or existing initiative fields (deprecated - use propDefs going forward)




### `filterableFields`

- *type:* `{string[]}` An array of strings.
- *in string context:* A comma-delimited list of strings. No escaping is used, so no commas can exist in the strings. Spaces are not trimmed.
- *default:* ``
- *settable?:* yes

Defines the instance properties that can populate the directory. Must be a list of instance property names which are associated with vocabularies.




### `gitcommit`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* Defined by `variant` attribute of the consuming project's file `config/version.json`
- *settable?:* no

The git commit-ID of the mykomap source code deployed.




### `htmlTitle`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* ``
- *settable?:* yes

If set, this will override the default value for the map's HTML <title> tag.




### `initialBounds`

- *type:* `{Box2d}` [[latitude, longitude],[latitude, longitude]] - A two-element array of two-element arrays of numbers, defining two pairs of latitude and longitudes in degrees. May be undefined.
- *in string context:* A comma-delimited list of four numbers defining two latitude and longitude pairs, in degrees.
- *default:* `undefined`
- *settable?:* yes

The initial bounds of the map as an array: [[n1,e1],[n2,e2]]; these are chosen automatically if this is unset




### `language`

- *type:* `{ISO639-1 Code}` 
- *in string context:* parsed as-is
- *default:* `EN`
- *settable?:* yes

The language to use for internationalised text. Must be one of those listed in `languages`, or it will be set to the first language code in `languages`. Will be upcased if not already.




### `languages`

- *type:* `{Array<ISO639-1 code>}` An array of ISO639-1 two-character country codes.
- *in string context:* A comma-delimited list of valid ISO639-1 codes. Spaces are trimmed, and the case will be normalised so does not matter, but invalid codes are errors
- *default:* `[
  "EN"
]`
- *settable?:* no

An array of supported languages which can be used for internationalised text. Should not be empty, and all codes should be upper case. Any other language code used will be replaced with the first in this list. A phrases for the first code will also used as a fallback if an individual phrase is missing.




### `logo`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* `undefined`
- *settable?:* yes

If set this will display the logo of the organisation. This takes in a link to a logo image loaded into an HTML <image>




### `mapAttribution`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* `Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> | Powered by <a href="https://www.geoapify.com/">Geoapify</a>`
- *settable?:* no

the attribution message to put at the bottom of the map




### `maxZoomOnGroup`

- *type:* `{number}` 
- *in string context:* parsed as-is
- *default:* `18`
- *settable?:* yes

The maximum zoom in that can happen when selecting any particular group in directory, if 0 does no zooming. Defaults to 18 and auto decides best max zoom




### `maxZoomOnOne`

- *type:* `{number}` 
- *in string context:* parsed as-is
- *default:* `18`
- *settable?:* yes

The maximum zoom in that can happen when selecting an initiative, if 0 does no zooming. Defaults to 18 and auto decides best max zoom




### `maxZoomOnSearch`

- *type:* `{number}` 
- *in string context:* parsed as-is
- *default:* `18`
- *settable?:* yes

The maximum zoom in that can happen when searching any particular group, if 0 does no zooming. Defaults to 18 and auto decides best max zoom




### `minZoom`

- *type:* `{number}` 
- *in string context:* parsed as-is
- *default:* `2`
- *settable?:* yes

The minimum zoom-in that the map can be zoomed too. AKA the maximum zoom-out. 0 does no zooming, 18 is the maximum. Defaults to 2, for backward compatibility with then this was hardwired.




### `mykoMapVersion`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* Defined by `variant` attribute of the consuming project's file `config/version.json`
- *settable?:* no

The git tag of the mykomap source code deployed.




### `noLodCache`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* True
- *settable?:* yes

Responses to SPARQL queries will normally be cached in /services/locCache.txt if this option is false or absent, with the aim of speeding up map loading time.The cache file is only updated if the static linked data's top-level index.rdf file is newer than the cache's timestamp. But if this option is set to true, this cache is disabled and a query is made each time the map is loaded.




### `propDefs`

- *type:* `{PropDefs}` A dictionary of initiative property definitions, or just a property type string, keyed by property id
- *in string context:* parsed as-is
- *default:* `[object Object]`
- *settable?:* no

Defines extended definitions of extended or existing initiative properties




### `searchedFields`

- *type:* `{string[]}` An array of strings.
- *in string context:* A comma-delimited list of strings. No escaping is used, so no commas can exist in the strings. Spaces are not trimmed.
- *default:* `name`
- *settable?:* yes

A list of fields that are looked at when using the search function. Valid values for this parameter are 'name', 'uri', and any custom field names supplied in the configuration.
If non-valid values are passed, the app will fail silently (no errors will be produced)
The default values are 'name'
Users can pass single arguments and multiple arguments, separated with a comma
Passing multiple values example: https://dev.ica.solidarityeconomy.coop/?searchedFields=regorg,otherActivities
Passing a single value example: https://dev.ica.solidarityeconomy.coop/?searchedFields=regorg

The search functionality works by creating a 'searchstr' string parameter for every initiative,this is populated using the values from the fields of the initiative (only the fields specified in the 'searchedFields' parameter are used)
Currently the field values added to the 'searchstr' parameter are concatenated (without spacing) to each other.
The 'searchstr' is then converted into uppercase. No other string transformations are currently applied
When a user uses the mykomap search the entered text will be converted into uppercase as well. If the searched text is included anywhere in the 'searchstr' value, the initiative is added to the results.




### `servicesPath`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* `services/`
- *settable?:* no

Preset location of the data source script(s).




### `showAboutPanel`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* `true`
- *settable?:* yes

If true this will load the datasets panel




### `showDatasetsPanel`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* `true`
- *settable?:* yes

If true this will load the datasets panel




### `showDirectoryPanel`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* `true`
- *settable?:* yes

If true this will load the datasets panel




### `showSearchPanel`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* `true`
- *settable?:* yes

If true this will load the datasets panel




### `sidebarButtonColour`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* `#39cccc`
- *settable?:* no

Set the css background-colour attribute for the open sidebar button. Defaults to teal




### `tileUrl`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* uses the OSM standard tile maps if nothing is provided
- *settable?:* no

the tile map url




### `timestamp`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* Defined by `variant` attribute of the consuming project's file `config/version.json`
- *settable?:* no

A timestamp string indicating when this application was deployed.




### `variant`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* Defined by `variant` attribute of the consuming project's file `config/version.json`
- *settable?:* no

The name of the variant used to generate this map application.




### `vocabularies`

- *type:* `{AnyVocabSource[]}` An array of vocab source definitions, defining a SPARQL endpoint URL, a default graph URI, and an index of vocabulary URIs to their prefixes - which must be unique to the whole array.
- *in string context:* parsed as-is
- *default:* No vocabs are queried if nothing is provided
- *settable?:* no

Specifies the vocabularies to obtain via SPARQL query for use in `propDefs`




