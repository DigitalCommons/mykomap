<?php

/** Log/respond following an error
 *
 * Logs the message `$msg` with `error_log`, and returns a JSON object
 * in the response body defining properties for `message` (set by
 * `$msg`), and `status` (always "error").
 * 
 * Then calls `exit($msg)`.
 *
 * @param $msg  A message to include in the log and response.
 * @param $code A HTTP return code to set in the response.
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

/** Specialised croak wrapper for reporting missing attributes in `config.json`.
 *
 * Calls `croak` with the appropriate parameters.
 *
 * @param $attr The name of the attribute.
 */
function croak_no_attr($attr) {
    croak("config.json is missing the attribute `$attr`");
}

   
