/**
 *
 * The purpose of this module is to insulate the rest of the application from
 * changes made to the format of config_json, version_json, etc.
 *
 * It returns an object with accessor methods for obtaining configured data.
 */

import {
  ConfigData,
  Config,
} from './config-schema';

export { ConfigData, Config };

export function init(inits: Partial<ConfigData> = new ConfigData()): Config {
  return new Config(inits);
}
