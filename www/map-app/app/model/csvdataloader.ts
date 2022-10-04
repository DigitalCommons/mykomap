import type { Dictionary } from '../../common_types';

import {
  DatasetMeta,
  DataLoader,
  DataConsumer,
  AggregatedData,
} from './dataloader';

import {
  InitiativeObj,
} from './dataservices';

import {
  Config,
} from './config';

import {
  parse,
  ParseError,
  ParseRemoteConfig,
  ParseResult,
  ParseStepResult,
  Parser,
} from "papaparse";


export class CsvDataLoader implements DataLoader {
  constructor(readonly id: string, readonly url: string) {}
  
  load<T extends DataConsumer>(dataConsumer: T): Promise<this> {
    const executor = (resolve: (v: this | PromiseLike<this>) => void , reject: (r?: any) => void) => {
      const onStep = (results: ParseStepResult<InitiativeObj>, parser: Parser) => {
        if (results.errors.length == 0) {
          // console.debug("CsvDataLoader step", results.data);
          dataConsumer.addBatch(this.id, [results.data])
        }
        else {
          // console.debug("CsvDataLoader step error", results.errors);
          results.errors
            .filter((e): e is ParseError => !!e)
            .forEach(e => reject(e));
        }
      };
      const onComplete = (results: ParseResult<InitiativeObj>) => {
        // console.debug("CsvDataLoader complete", results);
        resolve(this);
      };
      const onError = (error: Error) => {
        // console.log("error", error);
        reject(error);
      };
      const config: ParseRemoteConfig<InitiativeObj> = {
	      download: true,
	      header: true,
        step:  onStep,
        complete: onComplete,
        error: onError,
      };
      parse(this.url, config);
    };
    return new Promise<this>(executor) // Executes executor asynchronously
    // and handle resolutions once
      .then((val) => { dataConsumer.complete(this.id); return val; },
            (error: Error) => { dataConsumer.fail(this.id, error); return this; })
  }
}
