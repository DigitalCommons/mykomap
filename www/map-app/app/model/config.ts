/**
 *
 * The purpose of this module is to insulate the rest of the application from
 * changes made to the format of config_json, version_json, etc.
 *
 * It returns an object with accessor methods for obtaining configured data.
 */

//"use strict";

import { Point2d, Box2d } from '../../common_types';
import {
  ConfigTypes,
  ConfigSchemas,
  ConfigData,
  Config,
  ReadableConfig,
  WritableConfig,
  DialogueSize
} from './config_schema';

export { ConfigData, Config };

export function init(inits: ConfigData): Config {
  return new Config(inits);
}
