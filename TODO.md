ensure servers enable headers mod and site.conf is deployed for data

FIXME
- fieldIsCountries is hacked, not general! (see directory.js)

optimise vocab loading
- only load the current language (adjust gv to accept a parameter)
- cache the vocab on the server



make multi-data caching work

de-requirejs
- sidebar button
x pin icons
- Garamond font


Questions for vocab:
- move prefixes up and merge?
- prefixes for terms different for vocabs?
- meaning of ALL when multiple terms mixed?
- what if there's an ALL term already?


- de-dotcoop the default popup


# Fields

get rid of all of config.json, popup.js version.json
instead load the config in the code from somewhere

no more fetching of files on start.

this config should be versioned, and defines all the pop-ups, fields, etc.

it should support a single-sea-map server by allowing config to be loaded from more than one place - possibly from a database or API?

this could mean JSON is needed to be supported. therefore need good
validation to get this into a typed version of the config.


also, to support multi-site support, need queries etc. to be loaded from configurable place. 

This will need to be parsed by php scripts mainly (client-side too, optionally)



can we suport simple sea-map view of data, which is SPARQL agnostic?

accept compact JSON array of objects / arrays (keyed by index numbers)

extract configured fields only, map to internal objects with possibly different keys and different values, as defined by config


internal fields:
- value (string, number, boolean, date, ..?)
- enum
- 

Rename initiative to point of interest

POIFactory reads some stream and outputs a stream of POIs

inputs: SPARQL json, csv, json, graphQL

outputs: POIs

driven by a field schema, defining output fields

and a map schema specific to the input, defining rules for generation

simplest form is input field -> output field, possibly also a transform method or algorithm

poi_schema has mandatory fields: id, name?, lat?, long?

```
custom_poi_fields:
  field 1:
    type: string
  field 2:
    type: vocab
	vocab_id: aci
  field 3:
    type: enum
	values: [foo, bar, baz]
	
transform:
  type: sparql
  fields: 
    id:
	  from: param 2
    name:
	lat:
	long:
	field 1:
	  from: param3
	  using: toString
	field 2:
	  from: param4
	  using: toVocab
	  from: param1
	  using: toEnum
```


so sea-map consumes a stream of json objects

SPARQL layer generates that from get_dataset.php output, but actually the stream could be pre-generate server side.

get_dataset.php handles caching, JSON generation etc.



## xxx


FIXME
make popup.js a config param
make config accept a version?
allow config to define callbacks instead of values
define config using types

define a project file index.js


in this:

import sea-map



const config: SeaMapConfig = {


}

call
sea-map.fetchConfig(a,b,c,d).then(config => sea-map.webRun(window, config))


interface ConfigData {

}


class Config {
   constructor(configData: ConfigData) {
      this.data = configData;
   }

   aboutHtml(): string => data.aboutHtml;
   setAboutHtml(val: string) { data.aboutHtml = val; }



}
