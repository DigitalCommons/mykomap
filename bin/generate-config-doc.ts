#!/usr/bin/env ts-node

/** Generates a CONFIG.md documentation file from the schema in config.js
 */

/** Stub the Require.js framework `define` function. */
import { Config } from "../src/map-app/app/model/config_schema";
const config = new Config();
console.log(config.generateDoc());
