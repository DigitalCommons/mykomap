#!/bin/bash



export SEA_MAP_CONFIG_DIR=$(readlink -f config)


set errexit pipefail
cd ../src/


export REDIRECT_STATUS=200
export REQUEST_METHOD=POST
export SCRIPT_FILENAME=services/get_vocabs.php
export SCRIPT_NAME=/services/get_vocabs.php
export PATH_INFO=/
export SERVER_NAME=example.com
export SERVER_PROTOCOL=HTTP/1.1
export REQUEST_URI=/services/get_vocabs.php
export HTTP_HOST=example.com
export CONTENT_LENGTH=$(wc -c $SEA_MAP_CONFIG_DIR/config.json)

# This currently doesn't check anything, just prints out the response
php-cgi ./services/get_vocabs.php  <$SEA_MAP_CONFIG_DIR/config.json 

