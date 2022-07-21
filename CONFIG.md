
# `config.json`

This describes the schema of the `config.json` file consuming projects should supply,
and valid attributes thereof. It should be an object definition. Valid attributes are
described here. Valid attributes which are not defined in `config.json` will take a
default value. Those which are not valid are ignored.

Here is an example of what you might put in this file:

```
 {
  "namedDatasets": ["oxford"],
  "htmlTitle": "Solidarity Oxford",
  "filterableFields": [{ "field": "primaryActivity", "label": "Activities" }],
  "doesDirectoryHaveColours": true,
  "disableClusteringAtZoom": false
}
```

These values are defaults, however, which can be overridden in various ways,
as described in [README.md](README.md)

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

Sets the namespace prefix expected on the sea-map anchor element's attributes.




### `customPopup`

- *type:* `{InitiativeRenderFunction}` A function which accepts an Initiative instance and returns an HTML string
- *in string context:* parsed as-is
- *default:* `undefined`
- *settable?:* no

An optional function accepting an Initiative and an SseInitiative object, which returns an HTML string which will be used as the pop-up contents for that initiative's marker




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
- *in string context:* A comma-delimited list of name-value pairs, each delimited by a colon. Therefore no commas or colons can exist in either names or values. Spaces are not trimmed, and later key duplicates will overwrite earlier ones.
- *default:* ```
{
  "width": "35vw",
  "height": "225px",
  "descriptionRatio": 2.5
}
```
- *settable?:* yes

Set the dimensions of the dialogue box. Height and width are raw css values descriptionRatio is how many times larger the description section is than the contact section. These values are used in view/map.js




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

- *type:* `{PropDefs}` A dictionary of initiative property definitions, keyed by property id
- *in string context:* parsed as-is
- *default:* `undefined`
- *settable?:* no

Defines extended definitions of new or existing initiative fields




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

The git commit-ID of the sea-map source code deployed.




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

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* `EN`
- *settable?:* yes

The language to use for internationalised text. Must be one of those listed in `languages`, or it will be set to the first language code in `languages`. Will be upcased if not already.




### `languages`

- *type:* `{string[]}` An array of strings.
- *in string context:* A comma-delimited list of strings. No escaping is used, so no commas can exist in the strings. Spaces are not trimmed.
- *default:* ```
[
  "EN"
]
```
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




### `namedDatasets`

- *type:* `{string[]}` An array of strings.
- *in string context:* A comma-delimited list of strings. No escaping is used, so no commas can exist in the strings. Spaces are not trimmed.
- *default:* ``
- *settable?:* no

A list of names that correspond to directories in www/services, which must contain default-graph-uri.txt, endpoint.txt, query.rq.




### `namedDatasetsVerbose`

- *type:* `{string[]}` An array of strings.
- *in string context:* A comma-delimited list of strings. No escaping is used, so no commas can exist in the strings. Spaces are not trimmed.
- *default:* ``
- *settable?:* no

A list of names for the named datasets. Length must be exactly the same as namedDatasets or this will not be used




### `noLodCache`

- *type:* `{boolean}` 
- *in string context:* The empty string, 'false', or 'no' parse as `false`, everything else as `true`.
- *default:* True
- *settable?:* yes

Responses to SPARQL queries will normally be cached in /services/locCache.txt if this option is false or absent, with the aim of speeding up map loading time.The cache file is only updated if the static linked data's top-level index.rdf file is newer than the cache's timestamp. But if this option is set to true, this cache is disabled and a query is made each time the map is loaded.




### `seaMapVersion`

- *type:* `{string}` 
- *in string context:* parsed as-is
- *default:* Defined by `variant` attribute of the consuming project's file `config/version.json`
- *settable?:* no

The git tag of the sea-map source code deployed.




### `searchedFields`

- *type:* `{string[]}` An array of strings.
- *in string context:* A comma-delimited list of strings. No escaping is used, so no commas can exist in the strings. Spaces are not trimmed.
- *default:* `name`
- *settable?:* yes

A list of fields that are looked at when using the search function. Valid values for this parameter are:name,uri,www,regorg,sameas,desc,street,locality,region,postcode,country,primaryActivity,otherActivities,orgStructure,tel,email,qualifiers
if non-valid values are passed, the app will fail silently (no errors will be produced)
The default values are 'name'
Users can pass single arguments and multiple arguments, separated with a comma
Passing multiple values example: https://dev.ica.solidarityeconomy.coop/?searchedFields=regorg,otherActivities
Passing a single value example: https://dev.ica.solidarityeconomy.coop/?searchedFields=regorg

The search functionality works by creating a 'searchstr' string parameter for every initiative,this is populated using the values from the fields of the initiative (only the fields specified in the 'searchedFields' parameter are used)
Currently the field values added to the 'searchstr' parameter are concatenated (without spacing) to each other.
The 'searchstr' is then converted into uppercase. No other string transformations are currently applied
When a user uses the sea-map search the entered text will be converted into uppercase as well. If the searched text is included anywhere in the 'searchstr' value, the initiative is added to the results.




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




