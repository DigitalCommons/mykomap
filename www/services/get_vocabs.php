<?php
$vocabs_json = __DIR__ . "/../configuration/vocabs.json";

header('Content-type: application/json');
echo file_get_contents($vocabs_json);
