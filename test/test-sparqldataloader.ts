import 'cross-fetch/polyfill'; // d3.json needs window.fetch
import * as chaiAsPromised from 'chai-as-promised';
import { use, expect, assert } from 'chai';
import * as nock from 'nock';
import { json } from 'd3';

import { Config } from '../www/map-app/app/model/config';
import type {
  DataConsumer
} from '../www/map-app/app/model/dataloader';
import {
  loadDatasets,
} from '../www/map-app/app/model/dataservices';

import {
  PropDefs,
  Initiative,
  InitiativeObj,
  DataServices,
  basePropertySchema
} from '../www/map-app/app/model/dataservices';
import { VocabIndex, VocabServiceImpl } from '../www/map-app/app/model/vocabs';
import { Dictionary } from '../www/map-app/common_types';
import {
  SparqlDataLoader,
} from '../www/map-app/app/model/sparqldataloader';


use(chaiAsPromised);

const serviceUrl = 'http://example.com/sparql'
const cannedData = {
  "status": "success",
  "data": [
    {
      "name": "All China Federation of Supply and Marketing Co-operatives (ACFSMC)",
      "uri": "https://dev.lod.coop/ica/10",
      "within": "https://www.openstreetmap.org/?mlat=39.93317&mlon=116.37337",
      "lat": "39.93317",
      "lng": "116.37337",
      "www": "http://www.chinacoop.gov.cn",
      "regorg": "https://dev.lod.coop/essglobal/2.1/standard/organisational-structure/OS180",
      "desc": "<p><span style=\"line-height: 1.6em;\">All China Federation of Supply and Marketing Cooperatives (ACFSMC) is the national apex organization with membership of provincial federations, prefecture federations, county federations and primary co-operatives.</span></p>",
      "street": "45 Fu Xing Men Nei Street Xicheng District",
      "locality": "Beijing",
      "baseMembershipType": "https://dev.lod.coop/essglobal/2.1/standard/base-membership-type/BMT20",
      "postcode": "100801",
      "primaryActivity": "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/ICA290",
      "activity": "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/ICA10",
      "manLng": "0",
      "manLat": "0",
      "dataset": "ica"
    },
  ]
};

const datasetId = 'testDataset';
const dataLoader = new SparqlDataLoader(datasetId, serviceUrl);
class TestConsumer implements DataConsumer {
  constructor(readonly id: string, readonly data: InitiativeObj[] = []) { }
  isComplete: boolean = false;
  addBatch(id: string, initiatives: InitiativeObj[]) { assert(id === this.id); this.data.push(...initiatives) };
  complete(id: string) { assert(id === this.id); this.isComplete = true };
  fail(id: string, error: Error) { assert(id === this.id); assert(false); };
};

const consumer = new TestConsumer(datasetId);

const urlQuery = `?dataset=${consumer.id}&noLodCache=true`;
const scope = nock(serviceUrl)
  .persist()
  .get(urlQuery)
  .reply(200, cannedData);

// Finally, the tests
describe('SparqlDataLoader', async () => {
  
  it('check d3.json alone works', () => {    
    return json(serviceUrl + urlQuery)
      .then(result => {
        expect(result)
          .to.deep.equal(cannedData);
      });
  });

  it('check other URLs are rejected', () => {    
    return expect(json(serviceUrl + `?dataset=${consumer.id}&noLodCache=false`))
      .to.be.rejected;
  });

  it('one simple dataset', () => {

    expect(consumer.data).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets([dataLoader], consumer)
      .then(result => {
        expect(result.data)
          .to.deep.equal(cannedData.data);
        expect(result.isComplete)
          .to.equal(true);
      });
  });

});

