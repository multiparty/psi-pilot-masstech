/**
 * @jest-environment node
 */
require('dotenv').config();

const axios = require('axios');
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');
const listholder = require('./routes/list-creator')
const fs = require('fs');
const OPRF = require('oprf');
const args = require('yargs');

const oprf = new OPRF();
process.env.NODE_ENV = "testing";
const config = require('config');
const cpDomains = config.computePartyDomains;
const encodeType = config.encodeType;
const cpKeys = config.computePartyKeys;

var defaultOptions = {
  method: 'GET',
  url: 'http://' + cpDomains[0],
  headers:
  {
    'cache-control': 'no-cache',
    Connection: 'keep-alive',
    Host: cpDomains[0],
    'Cache-Control': 'no-cache',
    Accept: '*/*',
    'Content-Type': 'application/json',
  },
  data: {},
  responseType: 'json'
};

defaultOptions = JSON.stringify(defaultOptions);

test('Compute parties raise to key properly', done => {
  oprf.ready.then(function () {
    const input = dataGenerator.generateSsnArray(500).map(ssn => {
      return oprf.hashToPoint(ssn);
    });

    const result = input.map(hashedSSN => {
      // let rhet = hashedSSN;
      // cpKeys.forEach(key => {
      //   rhet = oprf.scalarMult(rhet, oprf.hashToPoint(key));
      // });
      return oprf.encodePoint(oprf.scalarMult(hashedSSN, oprf.hashToPoint(cpKeys[0])), encodeType);
    });

    let options = [];
    input.forEach((hashedSSN, i) => {
      const option = JSON.parse(defaultOptions);
      option.url = 'http://' + cpDomains[0] + '/computeparty/raiseToKey';
      option.data = { input: oprf.encodePoint(hashedSSN, encodeType) };
      options.push(option);
    });

    const requests = options.map(option => {
      return axios(option);
    });

    axios.all(requests)
      .then(axios.spread((...responses) => {
        const data = responses.map(response => {
          return response.data
        });

        expect(data).toEqual(result);
        done();
      }))
      .catch(function (error) {
        console.log(error);
      });
  });
});

test('List holder properly calculates shares to be sent out', done => {
  oprf.ready.then(async function () {
    const input = dataGenerator.generateSsnArray(5);

    // Shares is a 2D array that his cpDomains x input size large
    const shares = await listholder.computeAndSendShares(input, cpDomains);

    const correct = input.map(ssn => {
      return oprf.hashToPoint(ssn);
    });

    const result = shares[0].map((share, shareIndex) => {
      let randNum = oprf.generateRandomScalar();
      let shareSum = randNum;
      shares.forEach(domainShares => {
        shareSum = oprf.sodium.crypto_core_ristretto255_add(shareSum, oprf.decodePoint(domainShares[shareIndex], encodeType));
      });
      return oprf.sodium.crypto_core_ristretto255_sub(shareSum, randNum);
    });

    expect(result).toEqual(correct);
    done();
  });
});
