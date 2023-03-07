import 'cross-fetch/polyfill'; // d3.json needs window.fetch
import * as chaiAsPromised from 'chai-as-promised';
import { use, expect } from 'chai';
import * as nock from 'nock';
import { json } from 'd3';

import {
  loadDatasets,
} from '../src/map-app/app/model/data-services';

import {
  SparqlDataLoader,
} from '../src/map-app/app/model/sparqldataloader';

import {
  TestConsumer,
} from './testconsumer';

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

const datasetIds = ['testDataset1', 'testDataset2'];
const dataLoaders = datasetIds.map(id => new SparqlDataLoader(id, serviceUrl));

const urlQueries = datasetIds.map(id => `?dataset=${id}&noLodCache=true`);
const scope = nock(serviceUrl)
  .persist();

urlQueries.forEach(query => scope.get(query).reply(200, cannedData));

// Finally, the tests
describe('SparqlDataLoader', async () => {
  
  it('check d3.json alone works', () => {    
    return json(serviceUrl + urlQueries[0])
      .then(result => {
        expect(result)
          .to.deep.equal(cannedData);
      });
  });

  it('check other URLs are rejected', () => {    
    return expect(json(serviceUrl + `?dataset=${datasetIds[0]}&noLodCache=false`))
      .to.be.rejected;
  });

  it('one simple dataset', () => {
    const consumer = new TestConsumer([datasetIds[0]]);


    expect(consumer.data).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets([dataLoaders[0]], consumer)
      .then(result => {
        expect(result.data)
          .to.deep.equal(cannedData.data);
        expect(result.isComplete)
          .to.equal(true);
      });
  });

  it('more than one dataset', () => {
    // The test consumer will just concatenate all the datasets together as they arrive...
    const consumer = new TestConsumer(datasetIds);

    expect(consumer.data).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets(dataLoaders, consumer)
      .then(result => {
        expect(result.data)
          .to.deep.equal(cannedData.data.concat(cannedData.data)); // ...hence this works
        expect(result.isComplete)
          .to.equal(true);
      });
  });
});

