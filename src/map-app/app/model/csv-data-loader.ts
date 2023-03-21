import {
  DataLoader,
  DataConsumer,
} from './data-loader';

import {
  InitiativeObj,
} from './initiative';

import {
  ObjTransformFunc,
} from '../../obj-transformer';

import {
  parse,
  ParseError,
  ParseRemoteConfig,
  ParseResult,
  ParseStepResult,
  Parser as PapaParser,
} from "papaparse";


// Loads map pins from CSV data
export class CsvDataLoader<R extends object = string[]> implements DataLoader<InitiativeObj> {
  constructor(readonly id: string, readonly url: string, readonly rowTransform: ObjTransformFunc<R,InitiativeObj>) {}
  
  load(dataConsumer: DataConsumer<InitiativeObj>): Promise<this> {
	  const executor = (resolve: (v: this | PromiseLike<this>) => void , reject: (r?: unknown) => void) => {
	    const onStep = (result: ParseStepResult<R>, _: PapaParser) => {
		    if (result.errors.length == 0) {
		      // console.debug("CsvDataLoader step", results.data);
		      const initiative = this.rowTransform(result.data);
		      dataConsumer.addBatch(this.id, [initiative])
		    }
		    else {
		      // console.debug("CsvDataLoader step error", results.errors);
          result.errors
            .filter((e): e is ParseError => !!e)
            .forEach(e => reject(e));
        }
      };
      const onComplete = (_: ParseResult<R>) => {
        // console.debug("CsvDataLoader complete", results);
        resolve(this);
      };
      const onError = (error: Error) => {
        // console.log("error", error);
        reject(error);
      };
      const config: ParseRemoteConfig<R> = {
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
