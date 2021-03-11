<?php
/**
  
  # TITLE

  get_vocabs.php - gets a configurable label index of linked-data vocabularies in various languages

  # OVERVIEW

  The `config.json` file is read for definitions of:

  1. A list of vocabularies to index, and
  2. A list language identifiers to obtain labels for.

  See [CONFIG](#CONFIG) for details of this.

  Then the SPARQL endpoint FIXME is queried for the vocabulary labels,
  and this data is transformed into indexes (rather than a flat list).

  Given the resulting index datastructure in `$config`, to access the
  label in English (i.e. `$lang == 'EN'`) for a term `$term1` in the
  vocabulary `$vocab1`, use:

      $label = $config['vocabularies'][$vocab1]['language'][$lang]['terms'][$term1];

  FIXME case sensitivity?

  # CONFIG

  The form of `config.json` is a JSON object including attributes for
  sub-objects named `languages' and `vocabularies`. For example:

      {
        ...

        "languages": ["EN", "FR"],

        "vocabularies": {
          "https://lod.coop/essglobal/V2a/standard/activities":
            "http://data.solidarityeconomy.coop:8890/sparql",
          "https://lod.coop/essglobal/V2a/standard/organisational-structure":
            "http://data.solidarityeconomy.coop:8890/sparql"
        },

        ...
      }

 FIXME continue
*/
function croak($msg, $code = 500) {
    // Log the error before trying anything else
    error_log($msg);

    // Deliberately Old Skool PHP so we don't trigger another error    
    $protocol = 'HTTP/1.0';
    if (isset($_SERVER['SERVER_PROTOCOL']))
        $protocol = $_SERVER['SERVER_PROTOCOL'];
    header("$protocol $code $msg");

    // Report as JSON if possible
    try {
        $result = array();
        $result["status"] = "error";
        $result["message"] = $msg;
        $body = json_encode($result);
        header('Content-type: application/json');
        echo $body;
	}
    catch(Exception $e) {
        header('Content-type: text/plain');
        echo $msg;
    }
    
    exit($msg);
}

// Check the PHP version is adequate as soon as possible
$require_php = '5.6';
if (version_compare(phpversion(), $require_php, '<')) {
    croak("php version needs to be >= $require_php but is: " . phpversion());
}

function croak_no_attr($attr) {
    croak("config.json is missing the attribute `$attr`");
}

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


function escape_uri($uri) {
    return str_replace(['<', '>'], ['%3C', '%3E'], $uri);
}

// $graph is optional
function mk_sparql_url($endpoint, $query, $graph = NULL) {
    $dgu_param = '';
    if (isset($graph))
        $dgu_param = "default-graph-uri=".urlencode($graph)."&";
    $query_param = "query=".urlencode($query);
	return "$endpoint?$dgu_param$query_param";
}

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

// $graph is optional
function query($endpoint, $query, $graph = NULL) {
    $url = mk_sparql_url($endpoint, $query, $graph);
	$response = request($url);
	return json_decode($response, true);
}

// $graph is optional
function generate_query($vocab_uris, $langs, $graph = NULL) {
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
            $result['vocabs'][$shortVocab][$lang]['title'] ??= NULL;
        }
        else { // vocabulary info
            $result['vocabs'][$shortVocab][$lang]['title'] = $label;
        }
    }

    return $result;
}

function main() {
    // Predefined prefixes commonly seen in the data.  Any inferred
    // prefixes not in this list will have names generated starting
    // with an '_'
    $prefixes = [
        "https://dev.lod.coop/essglobal/2.1/standard/" => "essglobal",
        "https://dev.lod.coop/essglobal/2.1/standard/organisational-structure/" => "os",
        "https://dev.lod.coop/essglobal/2.1/standard/qualifier/" => "q",
        "https://dev.lod.coop/essglobal/2.1/standard/activities/" => "ac",
        "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/" => "aci",
        "https://dev.lod.coop/essglobal/2.1/standard/activities-modified/" => "acm",
        "https://dev.lod.coop/essglobal/2.1/standard/base-membership-type/" => "bmt",
        "https://dev.lod.coop/essglobal/2.1/standard/countries-iso/" => "coun",
        "https://dev.lod.coop/essglobal/2.1/standard/regions-ica/" => "reg",
        "https://dev.lod.coop/essglobal/2.1/standard/super-regions-ica/" => "sreg",
    ];

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
    $result = ['prefixes' => $prefixes];

    // Aggregate the query results in $result
    foreach($vocab_srcs as $vocab_src) {
        $endpoint = $vocab_src['endpoint'] ?? croak_no_attr('vocabularies[{endpoint}]');
        $uris = $vocab_src['uris'] ?? croak_no_attr('vocabularies[{uris}]');
        
        $query = generate_query($uris, $languages);
        #echo $query; # DEBUG
        $query_results = query($endpoint, $query);
        #echo json_encode($query_results); # DEBUG
        $result = add_query_data($result, $query_results);
    }
    
    header('Content-type: application/json');
    echo json_encode($result);
}

main();

/* 
Caveats/To do: 
- vocab titles are not internationalised in the data FIXME 
- undefed-defined prefix abbreviations will have underscore names creates
- config.json should be able to define prefix abbrevs.
- config.json should be able to define DGU?
- vocab data probably needs to be in the default graph
- language IDs are assumed simple (primary only), if not may need simplifying?
- Missing labels in the target languages may result in nulls / blanks / missing lang attrs? 
- query result data is assumed UTF8? likewise script output
- may need to think about ramifications of querying multiple endpoints/graphs? namespace clashes.
- allow config to define canned vocabs?
*/
