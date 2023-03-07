import { XMLHttpRequest } from 'xhr2-cookies';

import {
  parse,
  ParseResult,
  ParseStepResult,
} from 'papaparse';
import * as chaiAsPromised from 'chai-as-promised';
import { use, expect } from 'chai';
import * as nock from 'nock';

import {
  loadDatasets,
} from '../src/map-app/app/model/dataservices';

import { Dictionary } from '../src/map-app/common-types';
import {
  CsvDataLoader,
} from '../src/map-app/app/model/csvdataloader';
import {
  ObjTransform,
  Transforms as T,
  mkObjTransformer,
} from '../src/map-app/obj-transformer';
import {
  TestConsumer,
} from './testconsumer';
import { InitiativeObj } from '../src/map-app/app/model/initiative';

const cannedVocabs = require('./cannedVocabs.json');

// @ts-ignore
globalThis.XMLHttpRequest = XMLHttpRequest;

use(chaiAsPromised);

const serviceUrl = 'http://example.com'
const csvData = `\
Identifier,Name,Description,Organisational Structure,Primary Activity,Activities,Street Address,Locality,Region,Postcode,Country ID,Territory ID,Website,Phone,Email,Twitter,Facebook,Companies House Number,Qualifiers,Membership Type,Latitude,Longitude,Geo Container,Geo Container Latitude,Geo Container Longitude
100,All China Federation of Supply and Marketing Co-operatives (ACFSMC),"<p><span style=""line-height: 1.6em;"">All China Federation of Supply and Marketing Cooperatives (ACFSMC) is the national apex organization with membership of provincial federations, prefecture federations, county federations and primary co-operatives.</span></p>
",National apex,All,Agriculture;Industry;Utilities;Wholesale and retail trade;Financial Services,45 Fu Xing Men Nei Street Xicheng District,Beijing,,100801,CN,CN,http://www.chinacoop.gov.cn,,,,,,,Producers,0,0,https://www.openstreetmap.org/?mlat=39.93317&mlon=116.37337,39.93317,116.37337
101,Central Union of Agricultural Co-operatives (JA-ZENCHU),"<p>JA-ZENCHU (Central Union of Agricultural Co-operatives) is an apex body of Japan&#39;s agricultural co-operative movement, representing the interests of Japanese farmers and their agricultural co-operative organizations (JA Group). The basic objective of JA-ZENCHU is to contribute to the sound development of activities of the JA Group through formulating the common guideline and programs of their activities as well as through promoting implementations of these programs by the member organizations of the JA Group in this country.</p>

<p>In order to attain such objective, JA-ZENCHU plays various functions, in collaboration with its members of 47 Prefectural Unions of Agricultural Co-operatives throughout the country, including management guidance, auditing, farm policy representation and public relations activities for JAs (agricultural co-operatives) and their business federations. It also provides education and training services to staff members and officials of those organizations. </p>

<p>JA-ZENCHU, an independent nonprofit organization with the membership of all JAs and most of their JA organizations in the country, is operated with membership fees paid by these member organizations.</p>
",National sectoral federation or union,Agriculture,"",1-3-1 Otemachi Chiyodaku,Tokyo,,100-6837,JP,JP,https://www.zenchu-ja.or.jp/eng/,,,,,,,Producers,0,0,https://www.openstreetmap.org/?mlat=35.688107&mlon=139.765369,35.688107,139.765369`;


const cannedData = [
    {
      "activity":
        [10,80,230,260,140].map(id => `https://dev.lod.coop/essglobal/2.1/standard/activities-ica/ICA`+id),
      "baseMembershipType": "https://dev.lod.coop/essglobal/2.1/standard/base-membership-type/BMT20",
      "dataset": "ica",
      "desc": "<p><span style=\"line-height: 1.6em;\">All China Federation of Supply and Marketing Cooperatives (ACFSMC) is the national apex organization with membership of provincial federations, prefecture federations, county federations and primary co-operatives.</span></p>\n",
      "lat": 39.93317,
      "lng": 116.37337,
      "locality": "Beijing",
      "manLat": 0,
      "manLng": 0,
      "name": "All China Federation of Supply and Marketing Co-operatives (ACFSMC)",
      "postcode": "100801",
      "primaryActivity": "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/ICA290",
      "regorg": "https://dev.lod.coop/essglobal/2.1/standard/organisational-structure/OS180",
      "street": "45 Fu Xing Men Nei Street Xicheng District",
      "uri": "https://dev.lod.coop/ica/100",
      "within": "https://www.openstreetmap.org/?mlat=39.93317&mlon=116.37337",
      "www": "http://www.chinacoop.gov.cn",
    },
    {
      "activity": [],
      "baseMembershipType": "https://dev.lod.coop/essglobal/2.1/standard/base-membership-type/BMT20",
      "dataset": "ica",
      "desc": "<p>JA-ZENCHU (Central Union of Agricultural Co-operatives) is an apex body of Japan&#39;s agricultural co-operative movement, representing the interests of Japanese farmers and their agricultural co-operative organizations (JA Group). The basic objective of JA-ZENCHU is to contribute to the sound development of activities of the JA Group through formulating the common guideline and programs of their activities as well as through promoting implementations of these programs by the member organizations of the JA Group in this country.</p>\n\n<p>In order to attain such objective, JA-ZENCHU plays various functions, in collaboration with its members of 47 Prefectural Unions of Agricultural Co-operatives throughout the country, including management guidance, auditing, farm policy representation and public relations activities for JAs (agricultural co-operatives) and their business federations. It also provides education and training services to staff members and officials of those organizations.Â </p>\n\n<p>JA-ZENCHU, an independent nonprofit organization with the membership of all JAs and most of their JA organizations in the country, is operated with membership fees paid by these member organizations.</p>\n",
      "lat": 35.688107,
      "lng": 139.765369,
      "locality": "Tokyo",
      "manLat": 0,
      "manLng": 0,
      "name": "Central Union of Agricultural Co-operatives (JA-ZENCHU)",
      "postcode": "100-6837",
      "primaryActivity": "https://dev.lod.coop/essglobal/2.1/standard/activities-ica/ICA10",
      "regorg": "https://dev.lod.coop/essglobal/2.1/standard/organisational-structure/OS190",
      "street": "1-3-1 Otemachi Chiyodaku",
      "uri": "https://dev.lod.coop/ica/101",
      "within": "https://www.openstreetmap.org/?mlat=35.688107&mlon=139.765369",
      "www": "https://www.zenchu-ja.or.jp/eng/",
    },
  ];

const cannedData2 = [
  {
    Identifier: '100',
    Name: 'All China Federation of Supply and Marketing Co-operatives (ACFSMC)',
    Description: '<p><span style="line-height: 1.6em;">All China Federation of Supply and Marketing Cooperatives (ACFSMC) is the national apex organization with membership of provincial federations, prefecture federations, county federations and primary co-operatives.</span></p>\n',
    'Organisational Structure': 'National apex',
    'Primary Activity': 'All',
    Activities: 'Agriculture;Industry;Utilities;Wholesale and retail trade;Financial Services',
    'Street Address': '45 Fu Xing Men Nei Street Xicheng District',
    Locality: 'Beijing',
    Region: '',
    Postcode: '100801',
    'Country ID': 'CN',
    'Territory ID': 'CN',
    Website: 'http://www.chinacoop.gov.cn',
    Phone: '',
    Email: '',
    Twitter: '',
    Facebook: '',
    'Companies House Number': '',
    Qualifiers: '',
    'Membership Type': 'Producers',
    Latitude: '0',
    Longitude: '0',
    'Geo Container': 'https://www.openstreetmap.org/?mlat=39.93317&mlon=116.37337',
    'Geo Container Latitude': '39.93317',
    'Geo Container Longitude': '116.37337'
  },
  {
    Identifier: '101',
    Name: 'Central Union of Agricultural Co-operatives (JA-ZENCHU)',
    Description: '<p>JA-ZENCHU (Central Union of Agricultural Co-operatives) is an apex body of Japan&#39;s agricultural co-operative movement, representing the interests of Japanese farmers and their agricultural co-operative organizations (JA Group). The basic objective of JA-ZENCHU is to contribute to the sound development of activities of the JA Group through formulating the common guideline and programs of their activities as well as through promoting implementations of these programs by the member organizations of the JA Group in this country.</p>\n' +
      '\n' +
      '<p>In order to attain such objective, JA-ZENCHU plays various functions, in collaboration with its members of 47 Prefectural Unions of Agricultural Co-operatives throughout the country, including management guidance, auditing, farm policy representation and public relations activities for JAs (agricultural co-operatives) and their business federations. It also provides education and training services to staff members and officials of those organizations.Â </p>\n' +
      '\n' +
      '<p>JA-ZENCHU, an independent nonprofit organization with the membership of all JAs and most of their JA organizations in the country, is operated with membership fees paid by these member organizations.</p>\n',
    'Organisational Structure': 'National sectoral federation or union',
    'Primary Activity': 'Agriculture',
    Activities: '',
    'Street Address': '1-3-1 Otemachi Chiyodaku',
    Locality: 'Tokyo',
    Region: '',
    Postcode: '100-6837',
    'Country ID': 'JP',
    'Territory ID': 'JP',
    Website: 'https://www.zenchu-ja.or.jp/eng/',
    Phone: '',
    Email: '',
    Twitter: '',
    Facebook: '',
    'Companies House Number': '',
    Qualifiers: '',
    'Membership Type': 'Producers',
    Latitude: '0',
    Longitude: '0',
    'Geo Container': 'https://www.openstreetmap.org/?mlat=35.688107&mlon=139.765369',
    'Geo Container Latitude': '35.688107',
    'Geo Container Longitude': '139.765369'
  }
];

const datasetIds = ['testDataset1', 'testDataset2', 'badDataset', 'error'];


// This is the basic standard.csv field mapping to SPARQL query parameters.
// May vary from dataset to dataset!

type Row = Dictionary<string|null|undefined>;

const vocabUris = {
  orgStructs: 'https://dev.lod.coop/organisational-structure/',
  activities: 'https://dev.lod.coop/activities-modified/',
  qualifiers: 'https://dev.lod.coop/qualifiers/',
  membershipTypes: 'https://dev.lod.coop/base-membership-type/',
  countries: 'https://dev.lod.coop/countries-iso/',
  regions: 'https://dev.lod.coop/regions-ica/',
  superRegions: 'https://dev.lod.coop/super-regions-ica/',
  territories: 'https://dev.lod.coop/territories-ica/',
};

function objFlip(obj: Dictionary, t?: (x: string) => string) {
  return Object.keys(obj).reduce((ret, key) => {
    const val = obj[key];
    if (val)
      ret[val] = t? t(key) : key;
    return ret;
  }, {} as Record<string, string>);
}

const prefixes = objFlip(cannedVocabs.prefixes);

function vocabIndex(id: string, language: string = 'EN') {
  const terms = cannedVocabs.vocabs[id]?.[language]?.terms;
  if (!terms)
    throw new Error(`Can't find vocab ${id} language ${language} terms`);
  return objFlip(terms, x => x.replace(/^(.*?):/, (m, m1) => prefixes[m1]));
}
//console.log(vocabIndex('aci:'));
const baseUri = 'https://dev.lod.coop/ica/';

const rowTransform: ObjTransform<Row, InitiativeObj> = {
  uri: T.prefixed(baseUri).from('Identifier'),
  name: T.text('').from('Name'),
  lat: T.number(0).from('Geo Container Latitude'),
  lng: T.number(0).from('Geo Container Longitude'),
  manLat: T.number(0).from('Latitude'),
  manLng: T.number(0).from('Longitude'),
  dataset: T.text('').fixed('ica'),
  desc: T.text('').from('Description'),
  regorg: T.lookup({index: vocabIndex('os:'), default: ''}).from('Organisational Structure'),
  primaryActivity: T.lookup({index: vocabIndex('aci:'), default: '' }).from('Primary Activity'),
  activity: T.multi({of: T.lookup({index: vocabIndex('aci:'), default: ''}), omit: ['']}).from('Activities'),
  street: T.text('').from('Street Address'),
  locality: T.text('').from('Locality'),
  postcode: T.text('').from('Postcode'),
  www: T.text('').from('Website'),
  baseMembershipType: T.lookup({index: vocabIndex('bmt:'), default: ''}).from('Membership Type'),
  within: T.text('').from('Geo Container'),
};

const rowTransformer = mkObjTransformer<Row, InitiativeObj>(rowTransform);

const dataLoaders = datasetIds.map(id => new CsvDataLoader(id, `${serviceUrl}/${id}.csv`, rowTransformer));


const urlQueries = dataLoaders.map(dl => dl.url.replace(serviceUrl, ''));

// Define the mocked http responses
const scope = nock(serviceUrl)
  .persist();

urlQueries.forEach(query => {
  switch(query) {
    case '/testDataset1.csv':
    case '/testDataset2.csv':
      scope.get(query).reply(200, csvData, {
        // PapaParse requires the response to have a Content-Range
        'Content-Range': `bytes 0-${csvData.length-1}/${csvData.length}`
      });
      break;
    case '/badDataset.csv':
      const csvDataBroken = csvData.substring(0, csvData.length/3);
      scope.get(query).reply(200, csvDataBroken, {
        // PapaParse requires the response to have a Content-Range
        'Content-Range': `bytes 0-${csvDataBroken.length-1}/${csvDataBroken.length}`
      });
      break; 
    default:
      scope.get(query).reply(404);
      break;
  }
});


// Finally, the tests
describe('CsvDataLoader', async () => {
  
  it('check fetch alone works (papa)', () => {
    // Write data to the stream
    const data: Dictionary<string>[] = [];
    parse<Dictionary<string>>(serviceUrl + urlQueries[0], {
      download: true,
      header: true,
      step: (x: ParseStepResult<Dictionary<string>>) => { data.push(x.data); },
      complete: (x: ParseResult<Dictionary<string>>) => {
        expect(data).to.deep.equal(cannedData2);
      },
    });
  });

  it('one simple dataset', () => {
    const consumer = new TestConsumer(datasetIds);
    expect(consumer.data).to.deep.equal([]);
    expect(consumer.errors).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets([dataLoaders[0]], consumer)
      .then(result => {
        expect(result.data)
          .to.deep.equal(cannedData);
        expect(result.errors.length)
          .to.equal(0);
        expect(result.isComplete)
          .to.equal(true);
      });
  });

  it('two simple datasets', () => {
    const consumer = new TestConsumer(datasetIds);
    expect(consumer.data).to.deep.equal([]);
    expect(consumer.errors).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets([dataLoaders[0], dataLoaders[1]], consumer)
      .then(result => {
        expect(result.data)
          .to.deep.equal(cannedData.concat(cannedData));
        expect(result.errors.length)
          .to.equal(0);
        expect(result.isComplete)
          .to.equal(true);
      });
  });
  
  it('bad CSV dataset', () => {
    const consumer = new TestConsumer(datasetIds);
    expect(consumer.data).to.deep.equal([]);
    expect(consumer.errors).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets([dataLoaders[2]], consumer)
      .then(result => {
        expect(result.isComplete)
          .to.equal(true);
        expect(result.errors.length)
          .to.equal(1);
        expect(result.errors[0].message)
          .to.match(/Too few fields/);
        expect(result.data)
          .to.deep.equal([]);
      });
  });

  it('http not found error', () => {
    const consumer = new TestConsumer(datasetIds);
    expect(consumer.data).to.deep.equal([]);
    expect(consumer.errors).to.deep.equal([]);
    expect(consumer.isComplete).to.equal(false);
    
    return loadDatasets([dataLoaders[3]], consumer)
      .then(result => {
        expect(result.data)
          .to.deep.equal([]);
        expect(result.errors.length)
          .to.equal(1);
        expect(result.errors[0].message)
          .to.match(/Not Found/);
        expect(result.isComplete)
          .to.equal(true);
      });
  });
});



