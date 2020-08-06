/**
 * @jest-environment node
 */
require('dotenv').config();

const axios = require('axios');
const dataGenerator = require('../utils/data-generator');
const computeParty = require('./routes/compute-party');
// const ingest = require('../utils/ingest');
const listholder = require('./routes/list-creator')
const fs = require('fs');
const OPRF = require('oprf');
const args = require('yargs');

const oprf = new OPRF();
process.env.NODE_ENV = "testing";
const config = require('config');
const cpDomains = config.computePartyDomains;
const encodeType = config.encodeType;
const cpKeys = config.testKeys

var defaultOptions = {
  method: 'GET',
  url: cpDomains[0],
  data: {},
  responseType: 'json'
};

defaultOptions = JSON.stringify(defaultOptions);

test('Compute parties raise to key properly', done => {
  oprf.ready.then(async function () {

    const input = dataGenerator.generateSsnArray(500).map(ssn => {
      return oprf.hashToPoint(ssn);
    });

    const key = oprf.hashToPoint(cpKeys[0].pop());
    // Pop off all of the original keys because they will be replaced going forward
    for(let i = 0; i < config.creatorDomains.length-1; i++) {
      cpKeys[0].pop();
    }

    cpKeys.forEach(keyList => {
      if(keyList != cpKeys[0]) {
        config.creatorDomains.forEach(domain => {
          keyList.pop();
        });
      }
    });


    const result = input.map(hashedSSN => {
      return oprf.encodePoint(oprf.scalarMult(hashedSSN, key), encodeType);
    });

    let option = JSON.parse(defaultOptions);
    const data = input.map(hashedSSN => {
      return oprf.encodePoint(hashedSSN, encodeType);
    });

    option.url = cpDomains[0] + '/computeparty/raiseToKey';
    option.data = { input: data, creatorDomain: "http://localhost:3000" }

    axios(option)
      .then(function (response) {
        expect(response.data).toEqual(result);
        done();
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});


test('List holder properly calculates shares to be sent out', done => {
  oprf.ready.then(async function () {
    const input = dataGenerator.generateSsnArray(500);

    // Shares is a 2D array that his cpDomains x input size large
    const shares = (await listholder.computeAndSendShares(input, cpDomains)).shares;

    // Pop a key from each list since running computeAndSendShares will use a key from each CP
    cpKeys.forEach(keyList => {
      keyList.pop();
    });

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

test('CPs all calculate the same data', done => {
  oprf.ready.then(async function () {
    const input = dataGenerator.generateSsnArray(500);
    const keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    // Shares is a 2D array that is cpDomains x input size large
    const listholderResult = await listholder.computeAndSendShares(input, cpDomains);
    const shares = listholderResult.shares;
    const answers = listholderResult.results;

    const correct = input.map(ssn => {
      return oprf.scalarMult(keys[0], oprf.scalarMult(keys[1], oprf.scalarMult(keys[2], oprf.hashToPoint(ssn))));
    });

    expect(answers[0]).toEqual(answers[1]);
    expect(answers[2]).toEqual(answers[1]);
    done();
  });
});

test('CPs properly calculate masked data for single party', done => {
  oprf.ready.then(async function () {
    const input = dataGenerator.generateSsnArray(1);
    const keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    // Shares is a 2D array that is cpDomains x input size large
    const listholderResult = await listholder.computeAndSendShares(input, cpDomains);
    const shares = listholderResult.shares;
    const answers = listholderResult.results;

    const correct = input.map(ssn => {
      return oprf.scalarMult(keys[0], oprf.scalarMult(keys[1], oprf.scalarMult(keys[2], oprf.hashToPoint(ssn))));
    });

    // const result = shares[0].map((share, shareIndex) => {
    //   let randNum = oprf.generateRandomScalar();
    //   let shareSum = randNum;
    //   shares.forEach(domainShares => {
    //     shareSum = oprf.sodium.crypto_core_ristretto255_add(shareSum, oprf.decodePoint(domainShares[shareIndex], encodeType));
    //   });
    //   return oprf.sodium.crypto_core_ristretto255_sub(shareSum, randNum);
    // });

    console.log(oprf.encodePoint(correct[0], encodeType))
    console.log(answers[0][0]);

    const result = answers[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });
    console.log(correct);
    console.log(result);

    expect(oprf.decodePoint(answers[0], encodeType)).toEqual(correct);
    done();
  });
});

/*
test('CPs properly calculate masked data for multiple parties', done => {
  oprf.ready.then(async function () {
    const input = dataGenerator.generateSsnArray(200);
    const keys = cpKeys.map(keyList => {
      return keyList.pop();
    });

    // Shares is a 2D array that is cpDomains x input size large
    const firstListHolderResult = await listholder.computeAndSendShares(input, cpDomains);
    const shares = firstListHolderResult.shares;
    const answers = firstListHolderResult.results;

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
/* */
