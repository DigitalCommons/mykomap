#!/bin/bash



export SEA_MAP_CONFIG_DIR=$(readlink -f config)


set errexit pipefail
cd ../www/services

php ./get_vocabs.php

