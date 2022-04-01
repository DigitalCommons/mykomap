<?php
/*
  
  # TITLE

  get_vocabs.php - gets a configurable label index of linked-data vocabularies in various languages

  # OVERVIEW

  The `config.json` file is read for definitions of:

  1. A list of SKOS vocabulary schemes to index, and
  2. A list language identifiers to obtain labels for.

  (See [CONFIG](#CONFIG) for details of this.)

  Then, each item in the `vocabularies` array is used to create a
  SPARQL query for the given endpoints, that retrieves the vocabulary
  URIs and their `skos:prefLabel` properties in the languages defined
  by `languages`, where available.

  The resulting query data is then aggregated into an index of
  vocabulary term URIs and their labels in the requested languages.

  (See [OUTPUT DATA FORMAT](#OUTPUT-DATA-FORMAT) for details of this.)

  # CONFIG

  The form of `config.json` is a JSON object including attributes for
  sub-objects named `languages' and `vocabularies`. For example:

      {
        ...

        "languages": ["EN", ... ],

        "vocabularies": [
          { "endpoint": "http:\/\/dev.data.solidarityeconomy.coop:8890/sparql",
            "defaultGraphUri": "http:\/\/dev.lod.coop/ica",
            "uris": {
              "https:\/\/dev.lod.coop/essglobal/2.1/standard/activities-ica/": "aci",
              "https:\/\/dev.lod.coop/essglobal/2.1/standard/countries-iso/": "coun",
              "https:\/\/dev.lod.coop/essglobal/2.1/standard/regions-ica/": "reg",
              "https:\/\/dev.lod.coop/essglobal/2.1/standard/super-regions-ica/": "sreg",
              "https:\/\/dev.lod.coop/essglobal/2.1/standard/organisational-structure/": "os",
              "https:\/\/dev.lod.coop/essglobal/2.1/standard/base-membership-type/": "bmt",
               ...
            }
          }
          ...
        ],

        ...
      }

  Notice that there can be more than one endpoint, and each endpoint
  has a set of vocabularies associated. This is because each dataset
  *could* come from a separate endpoint, because each has its own
  `endpoint.txt` configuration file within the datasets' subdirectory
  (as well as its own request and default graph URI, therefore the
  vocabs could differ too.).

  There is a `defaultGraphUri` attribute too - this is optional, but
  recommended, because vocab queries can be extremely slow without it.
  As this graph is specific to the query, there needs to be one per
  query, as with `endpoint`.

  Notice also that each vocabulary URL, assumed to be a SKOS
  vocabulary scheme, has an associated abbreviation. Currently these
  MUST match the abbreviations hardwired in the code. The example
  above shows the requried prefixes at the time of writing. The URLs
  themselves can be whatever required to match the data being queried.

  Later, the fields defined for initiatives will be configurable, and
  then the prefixes will be too.


  # OUTPUT DATA FORMAT

  A slimmed-down example of the JSON data returned given the CONFIG
  example above.

      {
        "prefixes": {
          "https://dev.lod.coop/essglobal/2.1/standard/organisational-structure/": "os",
          "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/": "aci",
          "https://dev.lod.coop/essglobal/2.1/standard/base-membership-type/": "bmt",
          "https://dev.lod.coop/essglobal/2.1/standard/countries-iso/": "coun",
          "https://dev.lod.coop/essglobal/2.1/standard/regions-ica/": "reg",
          "https://dev.lod.coop/essglobal/2.1/standard/super-regions-ica/": "sreg"
        },
        "vocabs": {
          "bmt:": {
            "EN": {
              "title": "Typology",
              "terms": {
                "bmt:BMT20": "Producers",
                 ... other terms here ...
              },
              ... other languages here ...
            }
          },
          "os:": {
            "EN": {
              "title": "Structure Type",
              "terms": {
                "os:OS115": "Co-operative",
                 ... other terms here ...
              },
              ... other languages here ...
            }
          },
          "sreg:": {
            "EN": {
              "title": "Super Regions",
              "terms": {
                "sreg:I-AP": "Asia+Pacific",
                 ... other terms here ...
              },
              ... other languages here ...
            }
          },
          "reg:": {
            "EN": {
              "title": "Regions",
              "terms": {
                "reg:I-AM-CE": "Central America",
                 ... other terms here ...
              },
              ... other languages here ...
            }
          },
          "aci:": {
            "EN": {
              "title": "Economic Activities",
              "terms": {
                "aci:ICA140": "Financial Services",
                 ... other terms here ...
              },
              ... other languages here ...
            }
          }
        },
        "meta": {
          "vocab_srcs": [
            {
              "endpoint": "http://dev.data.solidarityeconomy.coop:8890/sparql",
              "uris": {
                "https://dev.lod.coop/essglobal/2.1/standard/organisational-structure/": "os",
                "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/": "aci",
                "https://dev.lod.coop/essglobal/2.1/standard/base-membership-type/": "bmt",
                "https://dev.lod.coop/essglobal/2.1/standard/countries-iso/": "coun",
                "https://dev.lod.coop/essglobal/2.1/standard/regions-ica/": "reg",
                "https://dev.lod.coop/essglobal/2.1/standard/super-regions-ica/": "sreg"
              }
            }
          ],
          "languages": [
            "EN",
            ... other languages here ...
          ],
          "queries": [
             ... SPARQL queries for each element of vocabs_srcs here ...
          ]
        }
      }

  Note that some or all vocabulary terms may be missing if they do not
  have `prefLabels` with the required language. The data needs to be
  provisioned with a full set to avoid this.

  When terms are present but the vocabulary `dc:title` is not
  localised, the title falls back to the un-localised title, if
  present (mainly because current data does not define localisations
  for these).

  URIs in the resulting data are also abbreviated whenever possibly by
  using the abbreviations defined in the `uris` section. So a term
  with the URI:

      https://dev.lod.coop/essglobal/2.1/standard/countries-iso/US

  Would be abbreviated to:

      coun:US

  The prefixes and abbreviations for them are supplied with the term
  data.

*/

require("./common.php");

/** Abbreviate a URI using the defined prefixes, if possible.
 *
 * @param &$prefixes The currently defined prefixes to use
 * @param $itme      The URI to abbreviate.
 * @return The URI, possibly abbreviated.
 */
function abbrev(&$prefixes, $item) {
    $matches = [];
    if (false === preg_match('{^(https?://.*[#/])(.*)}i', $item, $matches)) {
        return $item;
    }

    $prefix = $matches[1];
	$term = $matches[2];
	$abrv = $prefixes[$prefix] ?? '';
	if (!$abrv) {
	    $abrv = '_'.(sizeof($prefixes)+1); // invent a name
	    $prefixes[$prefix] = $abrv;
	}
    
	return "$abrv:$term";
}


/** Escape any `<` and `>` characters in a URI for use in a SPARQL query.
 *
 * @param $uri  A string to escape.
 * @return The escaped form of the URI.
 */
function escape_uri($uri) {
    return str_replace(['<', '>'], ['%3C', '%3E'], $uri);
}

/** Constructs a SPARQL query URL, incorporating a query and a default graph
 *
 * @param $endpoint  The base URL for the SPARQL endpoint we want to address
 * @param $query     A SPARQL query, which will be escaped
 * @param $graph     An optional default graph URI to pass
 */
function mk_sparql_url($endpoint, $query, $graph = NULL) {
    $dgu_param = '';
    if (isset($graph))
        $dgu_param = "default-graph-uri=".urlencode($graph)."&";
    $query_param = "query=".urlencode($query);
	return "$endpoint?$dgu_param$query_param";
}

/** Post a GET request to the given URL, returning the response.
 *
 * On failure, calls `croak` with the error.
 *
 * @param $url  The URL to post to
 * @return A PHP Reponse instance on success.
 */
function request($url) {
	// is curl installed?
	if (!function_exists('curl_init')) {
		croak("PHP can't find function curl_init. Is CURL installed?");
	}
    
	$ch = curl_init();
    try {
        $headers = ["Accept: application/json"];
        
        // set request url
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        
        // return response, don't print/echo
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        // These settings should (untested) turn off caching
        // Normally, we'd want all the caching we can get!
        //curl_setopt($ch, CURLOPT_FORBID_REUSE, true); 
        //curl_setopt($ch, CURLOPT_DNS_USE_GLOBAL_CACHE, false); 
        //curl_setopt($ch, CURLOPT_FRESH_CONNECT, true); 
        
        //curl_setopt($ch, CURLOPT_TIMEOUT, 300);
        //curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 60);
        
        // See curl docs: http://www.php.net/curl_setopt
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            throw new Exception("PHP curl_exec produces error: " . curl_error($ch));
        }

        return $response;
    }
    catch(Exception $e) {
        curl_close($ch);
        croak("Query error - ".$e->getMessage());
    }
}

/** Posts a query to the given SPARQL endpoint, gets the result
 *
 * Calls `croak` on failure.
 *
 * @param $endpoint  The SPARQL endpoint URL
 * @param $query     The SPARQL query to post
 * @param $graph     An optional default graph URI to specify. This is advisory
 * as without specifying it, the queries can be much slower.
 * @return On success, the query response decoded from JSON format into a PHP datastructure.
 */
function query($endpoint, $query, $graph = NULL) {
    $url = mk_sparql_url($endpoint, $query, $graph);
	$response = request($url);
	return json_decode($response, true);
}

/** Constructs a SPARQL query to get the vocab terms
 *
 * @param $vocabs A datastructure equivalent to the `vocabularies`
 * attribute of `config.json`, containing a list of objects. Each
 * object defines an endpoint URI, and an index of vocabulary scheme
 * URIs mapped to their abbreviation.
 * @param $langs  An array of one or more language identifier codes.
 * @param $graph  An optional default graph URI for the query.
 * @return  On success, a SPARQL query string.
 */
function generate_query($vocabs, $langs, $graph = NULL) {
    $graph = escape_uri($graph);
    $quote = function($uri) {
        return '<'.escape_uri($uri).'>';
    };
    $in_scheme = function($uri) {
        $escaped_uri = escape_uri($uri);
        return "{ ?term skos:inScheme <$escaped_uri> }"; 
    };
    $lang_filter = function($str) {
        return 'langMatches(lang(?label), "'.addslashes(strtolower($str)).'")';
    };

    $vocab_uris = array_keys($vocabs);
    $scheme_constraints = join("\n    UNION\n    ", array_map($in_scheme, $vocab_uris));
    $scheme_list = join(",\n    ", array_map($quote, $vocab_uris));
    $scheme_filter = "FILTER(?scheme IN (\n    $scheme_list\n    ))";
    $langs_filter_expr = join(" || ", array_map($lang_filter, $langs));
    $langs_constraints = "FILTER ($langs_filter_expr)";

    // In this query, we combine two queries: one for vocabulary
    // (scheme) info, and one for term info. Rows with no term IDs are
    // the former.
    return <<<QUERY
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT DISTINCT ?scheme ?term ?label
WHERE {
  { # vocabulary info
    ?scheme a skos:ConceptScheme; dc:title ?label.
    $scheme_filter
  }
  UNION
  { # term info
    ?term
       a skos:Concept;
       skos:inScheme ?scheme.
    OPTIONAL { ?term skos:prefLabel ?label. }
    $scheme_constraints
    $langs_constraints
  }
}
QUERY;
}

/** Aggregates the raw JSON results of a SPARQL query into an index datastructure
 *
 * 
 * @param $result  An array into which to add the results. Should consist of at minimum
 * an array with a single element `prefixes` referencing an empty array.
 * @param $query_results The raw JSON obtained from a SPARQL query
 * generated by `generate_query`.
 * @return The updated version of `$result`
 */
function add_query_data($result, $query_results) {
    $data = $query_results['results']['bindings'];
    $prefixes = &$result['prefixes'];
    
    foreach($data as $row) {
        // Common fields to all rows
        $vocab = $row['scheme']['value'];
        $shortVocab = abbrev($prefixes, $vocab);
        $label = $row['label']['value'];       
        $lang = $row['label']['xml:lang'] ?? 'EN';
        $lang = strtoupper($lang);
        
        $term = $row['term']['value'] ?? '';
        // FIXME check for overwriting data
        if ($term) { // term info
            $shortTerm = abbrev($prefixes, $term);            
            $result['vocabs'][$shortVocab][$lang]['terms'][$shortTerm] = $label;

            // Ensure title is present, even if null
            $vocab = $result['vocabs'][$shortVocab][$lang];
            $vocab['title'] = $vocab['title'] ?? NULL;
        }
        else { // vocabulary info
            $result['vocabs'][$shortVocab][$lang]['title'] = $label;
        }
    }

    return $result;
}


/** The main entry-point for this script
 *
 * Reads the config, constructs and posts the queries, returns the
 * aggregated result as the response body, with content-type
 * `application/json`.
 */
$dev_cache_file = "./get_vocabs.json";
function main() {
    global $dev_cache_file;
    if (file_exists($dev_cache_file)) {
        $content = file_get_contents($dev_cache_file);
        header('Content-type: application/json');
        echo $content;
        return;
    }

    // Predefined prefixes commonly seen in the data.  Any inferred
    // prefixes not in this list, or obtained from config.json, will
    // have names generated starting with an '_'
    $prefixes = [];

    // allow override in tests
    $config_dir = getenv('SEA_MAP_CONFIG_DIR');
    if (!$config_dir) 
        $config_dir = __DIR__ . "/../configuration";

    $config = json_decode(file_get_contents("$config_dir/config.json"), true);

    // Validate the required attributes are present.  This is fairly
    // rudimentary, exhaustive checks probably don't belong here.
    foreach(['vocabularies', 'languages'] as $attr) {
        // FIXME check type of attribute
        if (!isset($config[$attr]))
            croak_no_attr($attr);
    }

    $vocab_srcs = $config['vocabularies'];
    $languages = $config['languages'];
    $result = [
        'prefixes' => &$prefixes,
        'meta' => [
            'vocab_srcs' => $vocab_srcs,
            'languages' => $languages,
            'queries' => [],
        ],
    ];

    // Aggregate the query results in $result
    foreach($vocab_srcs as $vocab_src) {
        $endpoint = $vocab_src['endpoint'] ?? croak_no_attr('vocabularies[{endpoint}]');
        $default_graph_uri = $vocab_src['defaultGraphUri'] ?? null; // optional, but speeds the query

        $uris = $vocab_src['uris'] ?? croak_no_attr('vocabularies[{uris}]');
        if (empty($uris)) {
            continue; // Don't make a query if there are no URIs!
        }

        $prefixes = array_merge($uris);
        $query = generate_query($uris, $languages);
        #echo $query; # DEBUG
        $query_results = query($endpoint, $query, $default_graph_uri);
        
        #echo json_encode($query_results); # DEBUG
        $result = add_query_data($result, $query_results);
        $result['meta']['queries'][] = $query;
    }

    header('Content-type: application/json');
    echo json_encode($result);
}

// Call the entrypoint.
main();

