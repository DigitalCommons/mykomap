<?php
// Based on code originally written by:
// Author: John Wright
// Website: http://johnwright.me/blog
// This code is live @ 
// http://johnwright.me/code-examples/sparql-query-in-code-rest-php-and-json-tutorial.php
$base_url = __DIR__ . "/../configuration";
//$cacheFile = "locCache.json";
//TODO sanitize all user input
function report_success($response, $use_cache)
{
	$result = array();
	// API response uses JSend: https://labs.omniti.com/labs/jsend
	$result["status"] = "success";
	$result["data"] = $response;
	$json_res = json_encode($result);
	//make sure no one else can write and file exists only for us
	//should be safe (i.e. writing .json and hardcoded value for name)
	//check if cached should be saved
	if ($use_cache) {
		file_put_contents("locCache.json", $json_res);
	}
	echo $json_res;
}
function report_error_and_die($msg)
{
	$result = array();
	// API response uses JSend: https://labs.omniti.com/labs/jsend
	$result["status"] = "error";
	$result["message"] = $msg;
	if (function_exists('http_response_code')) {
		http_response_code(500);
	} else {
		// TODO - use header() function
	}
	echo json_encode($result);
	exit(1);
}
function needsUpdate($dataset)
{
	global $base_url;
	$default_graph_uri = trim(file_get_contents("$base_url/$dataset/default-graph-uri.txt"));
	if (substr($default_graph_uri, -1) != "/") {
		$default_graph_uri = $default_graph_uri . "/";
	}
	//get timestamp and put it in a timestamp file

	//get the timestamp
	// is curl installed?
	if (!function_exists('curl_init')) {
		report_error_and_die("PHP can't find function curl_init. Is CURL installed?");
	}
	$ch = curl_init();

	// set request url
	curl_setopt($ch, CURLOPT_URL, $default_graph_uri);

	// return response, don't print/echo
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_NOBODY, true);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
	curl_setopt($ch, CURLOPT_MAXREDIRS, 100);
	curl_setopt($ch, CURLOPT_FILETIME, true);

	$response = curl_exec($ch);
	$info = curl_getinfo($ch);
	$curl_timestamp = date("Y-m-d H:i:s", $info['filetime']);

	// check if file and get content if so
	if (file_exists("latest_timestamp.txt")) {
		$latest_timestamp_on_file = trim(file_get_contents("latest_timestamp.txt"));
		// if there is no timestamp don't update
		if ($latest_timestamp_on_file != $curl_timestamp && $info['filetime'] != -1) {
			# update file and flag for update
			file_put_contents("latest_timestamp.txt", $curl_timestamp);
			return true;
		}
	} else {
		// $latest_timestamp = trim(file_get_contents("$base_url/$dataset/default-graph-uri.txt")); the request
		if ($info['filetime'] != -1) {
			file_put_contents("latest_timestamp.txt", $curl_timestamp);
		}
		return true;
	}
	return false;
}
function getSparqlUrl($dataset, $q, $uid)
{
	// TODO - pass in SPARQL parameters as script arguments?

	global $base_url;
	$query = file_get_contents("$base_url/$dataset/$q");
	$endpoint = trim(file_get_contents("$base_url/$dataset/endpoint.txt"));
	$default_graph_uri = trim(file_get_contents("$base_url/$dataset/default-graph-uri.txt"));

	$query = str_replace("__UID__", addslashes($uid), $query);
	// TODO - Consider using HTTP POST?
	$searchUrl = $endpoint . '?'
		. 'default-graph-uri=' . urlencode($default_graph_uri)
		. '&query=' . urlencode($query);

	return $searchUrl;
}
function request($url)
{


	// is curl installed?
	if (!function_exists('curl_init')) {
		report_error_and_die("PHP can't find function curl_init. Is CURL installed?");
	}
	$ch = curl_init();

	$headers = array(
		"Accept: application/json"
	);

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
		report_error_and_die("PHP curl_exec produces error: " . curl_error($ch));
	}

	curl_close($ch);

	return $response;
}

// TODO: Need to make more secure
$dataset = $_GET["dataset"];
$q = "query.rq";
if (isset($_GET["uid"])) {
	switch ($_GET['q']) {
		case "main":
			break;
		case "activities":
			$q = "activities.rq";
			break;
		case "orgStructure":
			$q = "org-structure.rq";
			break;
		default:
			break;
	}
}

$use_cache = false;
if (isset($_GET["use_cache"])) {
	$use_cache = true;
}


if ($use_cache && file_exists("locCache.json") && !isset($_GET["uid"]) && !needsUpdate($dataset)) {
	$cached_res = file_get_contents("locCache.json");
	echo $cached_res;
} else {
	// Add a uid to get the values for a specific initiative (currently used for activities and org structure)
	// TODO: Need to make more secure
	$uid = isset($_GET["uid"]) ? $_GET["uid"] : "";

	$requestURL = getSparqlUrl($dataset, $q, $uid);
	$response = request($requestURL);
	$res = json_decode($response, true);

	// The keys correspond to two things:
	//   1. The names of the variables used in the SPARQL query (see Initiative::create_sparql_files in generate-triples.rb)
	//   2. The names used in the JSON that is returned to the map-app
	$keys = array("name", "uri", "within", "lat", "lng", "www", "regorg", "sameas", "desc", "street", "locality", "region", "qualifier", "baseMembershipType", "postcode", "country", "twitter", "facebook", "primaryActivity", "activity", "orgStructure", "tel", "email", "manLng", "manLat");
	// $keys = array("name", "uri", "lat", "lng", "country");

	$result = array();
	foreach ($res["results"]["bindings"] as $item) {
		$obj = array();
		foreach ($keys as $key) {
			// Some keys are optional (e.g. www and regorg). Check a key is defined before using it:
			if (array_key_exists($key, $item)) {
				$obj[$key] = $item[$key]["value"];
			}
		}
		// As well as what comes back from the SPARQL query, we manually add the name of the dataset
		// (i.e. the sub-directory of this script which contained the details of the query)): 
		$obj["dataset"] = $dataset;
		array_push($result, $obj);
	}

	// echo json_encode($requestURL);
	report_success($result, $use_cache);
}
