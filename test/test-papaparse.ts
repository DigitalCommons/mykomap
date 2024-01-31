import * as fs from 'fs';
import * as path from 'path';
import { XMLHttpRequest } from 'xhr2-cookies';

import {
  parse,
  ParseResult,
  ParseStepResult,
} from 'papaparse';
import * as chaiAsPromised from 'chai-as-promised';
import { use, expect } from 'chai';
import * as nock from 'nock';
import { Url } from 'url';

import { Dictionary } from '../src/map-app/common-types';


// @ts-ignore
globalThis.XMLHttpRequest = XMLHttpRequest;

use(chaiAsPromised);

const serviceUrl = 'http://example.com'



class MockHttp {
  private scope: nock.Scope;
//  private paths: Dictionary<string> = {};
  
  constructor(private baseUrl: string|RegExp|Url) {
    // Define the mocked http responses
    this.scope = nock(this.baseUrl)
      .persist();
  }

  mock(path: string, content?: string, code?: number): MockHttp {
    //    this.paths[path] = content;
    path.replace('^/?', '/'); // Ensure path has a leading slash
    if (content === undefined) {
      this.scope.get(path).reply(
        code ?? 404, content,
      );      
    }
    else {
      this.scope.get(path).reply(
        code ?? 200, content, {
          // PapaParse requires the response to have a Content-Range
          'Content-Range': `bytes 0-${content.length-1}/${content.length}`,
        },
      );
    }
    return this;
  }
}

// This assumes PWD is the project directory...
const largeCsv = fs.readFileSync('./test/data/csv/large.csv').toString();
const http = new MockHttp(serviceUrl)
  .mock('/1/large.csv', largeCsv);

// Finally, the tests
describe('PapaParse', async () => {
  
  it('check papa parses', () => {
    // FIXME test this on CUK's dataset, which is chunky and was failing in mykomap
    const url = 'http://dev.data.solidarityeconomy.coop/coops-uk/standard.csv';
    //; serviceUrl+'/1/large.csv';
    
    const data: Dictionary<string>[] = [];
    parse<Dictionary<string>>(url, {
      download: true,
      header: true,
      chunk: (x) => { console.log("streaming", x); },
      step: (x: ParseStepResult<Dictionary<string>>) => { data.push(x.data); },
      complete: (x: ParseResult<Dictionary<string>>) => {
        //        expect(data).to.deep.equal(cannedData2);
        console.log(data);
      },
    });
  });
});
