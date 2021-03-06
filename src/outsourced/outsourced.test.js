/**
 * @jest-environment node
 */
require('dotenv').config();

const axios = require('axios');
const dataGenerator = require('../utils/data-generator');
// const computeParty = require('./routes/compute-party');
const ingest = require('../utils/ingest');
// const listholder = require('./routes/list-creator');
const querier = require('./routes/query-list');
const fs = require('fs');
const OPRF = require('oprf');
const glob = require("glob");

const oprf = new OPRF();
process.env.NODE_ENV = "testing";
const config = require('config');
const cpDomains = config.computePartyDomains;
const dataDomains = config.dataDomains;
const encodeType = config.encodeType;
const cpKeys = config.testKeys

const dataSize = 10;

var defaultOptions = {
  method: 'POST',
  url: cpDomains[0],
  data: {},
  responseType: 'json'
};

defaultOptions = JSON.stringify(defaultOptions);

async function deleteTestFiles() {
  await glob.sync("**/compute*.csv").map(file => {
    fs.unlinkSync(file);
  });

  return 0;
}

test('Compute parties raise to key properly', done => {
  oprf.ready.then(async function () {

    const input = dataGenerator.generateSsnArray(dataSize).map(ssn => {
      return oprf.hashToPoint(ssn);
    });

    const key = oprf.hashToPoint(cpKeys[0].pop());
    // Pop off all of the original keys because they will be replaced going forward
    for (let i = 0; i < config.dataDomains.length - 1; i++) {
      cpKeys[0].pop();
    }

    cpKeys.forEach(keyList => {
      if (keyList != cpKeys[0]) {
        config.dataDomains.forEach(domain => {
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

    option.method = 'GET';
    option.url = cpDomains[0] + '/computeparty/raiseToKey';
    option.data = { input: data, dataDomain: dataDomains[0] }

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
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input;
    option.data.cpDomains = cpDomains;

    // Shares is a 2D array that his cpDomains x input size large
    const shares = await axios(option)
      .then(function (response) {
        return response.data.shares;
      })
      .catch(function (error) {
        console.log(error);
      });

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


test('Querier properly calculates shares to be sent out', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);

    // Shares is a 2D array that his cpDomains x input size large
    const shares = (await querier.computeAndSendShares(input, cpDomains, dataDomains[0])).shares;

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

let lastKeys;
test('CPs all calculate the same data for list creator', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    const keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    lastKeys = keys;

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input;
    option.data.cpDomains = cpDomains;

    const listholderResult = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });

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

test('CPs all calculate the same data for querier', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    const keys = lastKeys;

    const queryResult = await querier.computeAndSendShares(input, cpDomains, dataDomains[0])
    const shares = queryResult.shares;
    const answers = queryResult.results;

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
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    const keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    lastKeys = keys;

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input;
    option.data.cpDomains = cpDomains;

    const listholderResult = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    const shares = listholderResult.shares;
    const answers = listholderResult.results;

    const correct = input.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
    });

    // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
    const result = answers[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });

    expect(result).toEqual(correct);
    done();
  });
});

test('CPs properly calculate masked data for single query', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    // Use the keys last used by the list creators
    const keys = lastKeys

    const queryResult = await querier.computeAndSendShares(input, cpDomains, dataDomains[0])
    const shares = queryResult.shares;
    const answers = queryResult.results;

    const correct = input.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
    });

    // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
    const result = answers[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });

    expect(result).toEqual(correct);
    done();
  });
});


test('CPs properly calculate masked data for multiple parties', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input1 = dataGenerator.generateSsnArray(dataSize);
    const keys1 = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input1;
    option.data.cpDomains = cpDomains;

    const listholderResult1 = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    const shares1 = listholderResult1.shares;
    const answers1 = listholderResult1.results;

    const correct1 = input1.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys1[0]), keys1[1]), keys1[2]);
    });

    // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
    const result1 = answers1[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });

    const input2 = dataGenerator.generateSsnArray(dataSize);
    const keys2 = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    option.url = dataDomains[1] + '/listcreator/computeAndSendShares';
    option.data.input = input2;
    option.data.cpDomains = cpDomains;

    const listholderResult2 = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    const answers2 = listholderResult2.results;

    const correct2 = input2.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys2[0]), keys2[1]), keys2[2]);
    });

    // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
    const result2 = answers2[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });

    expect(result1).toEqual(correct1);
    expect(result2).toEqual(correct2);
    done();
  });
});

test('CPs properly write masked data for single party to table', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    const keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input;
    option.data.cpDomains = cpDomains;

    await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });

    const correct = input.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
    });

    let data = ingest.readCsv("./outsourced/compute0table0.csv");
    data = data.map(entry => {
      return oprf.decodePoint(entry.ssn, encodeType);
    });

    expect(data).toEqual(correct);
    done();
  });
});

test('Querier gets correct table data back from CP', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    const keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input;
    option.data.cpDomains = cpDomains;

    await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });

    let correct = ingest.readCsv("./outsourced/compute0table0.csv");
    correct = correct.map(entry => {
      return entry.ssn;
    });

    const result = await querier.getTableData(dataDomains[0]);

    expect(result).toEqual(correct);
    done();
  });
});

test('CPs properly calculate masked data for multiple requests from single party', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const input = dataGenerator.generateSsnArray(dataSize);
    let keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = input;
    option.data.cpDomains = cpDomains;

    let listholderResult = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    let answers = listholderResult.results;

    const correct = input.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
    });

    // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
    const result = answers[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });

    expect(result).toEqual(correct);

    const input2 = dataGenerator.generateSsnArray(dataSize);
    const overallInput = input.concat(input2);
    keys = cpKeys.map(keyList => {
      return oprf.hashToPoint(keyList.pop());
    });

    option.data.input = input2;

    // Do a second request
    listholderResult = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    answers = listholderResult.results;

    const overallCorrect = overallInput.map(ssn => {
      return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
    });

    // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
    const overallResult = answers[0].map(cp0Answer => {
      return oprf.decodePoint(cp0Answer, encodeType);
    });

    expect(overallResult).toEqual(overallCorrect);
    done();
  });
});

test('CPs properly calculate masked data for multiple requests from multiple parties', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    for (let i = 0; i < dataDomains.length; i++) {
      const input = dataGenerator.generateSsnArray(dataSize);
      let keys = cpKeys.map(keyList => {
        return oprf.hashToPoint(keyList.pop());
      });

      let option = JSON.parse(defaultOptions);
      option.url = dataDomains[i] + '/listcreator/computeAndSendShares';
      option.data.input = input;
      option.data.cpDomains = cpDomains;

      let listholderResult = await axios(option)
        .then(function (response) {
          return response.data;
        })
        .catch(function (error) {
          console.log(error);
        });

      let answers = listholderResult.results;

      const correct = input.map(ssn => {
        return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
      });

      // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
      const result = answers[0].map(cp0Answer => {
        return oprf.decodePoint(cp0Answer, encodeType);
      });

      expect(result).toEqual(correct);

      const input2 = dataGenerator.generateSsnArray(dataSize);
      const overallInput = input.concat(input2);
      keys = cpKeys.map(keyList => {
        return oprf.hashToPoint(keyList.pop());
      });

      option.data.input = input2;

      listholderResult = await axios(option)
        .then(function (response) {
          return response.data;
        })
        .catch(function (error) {
          console.log(error);
        });
      answers = listholderResult.results;

      const overallCorrect = overallInput.map(ssn => {
        return oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.hashToPoint(ssn), keys[0]), keys[1]), keys[2]);
      });

      // It's been established that all the CPs find the same answer, so it is sufficient to check that just one of them is correct in its calculations
      const overallResult = answers[0].map(cp0Answer => {
        return oprf.decodePoint(cp0Answer, encodeType);
      });

      expect(overallResult).toEqual(overallCorrect);
    }

    done();
  });
});

test('querylist/checkIfInList properly returns indexes of values in table', done => {
  oprf.ready.then(async function () {
    await deleteTestFiles();

    const dataSize = 200;
    const queriesInTable = 20;
    const numberOfQueries = 100;

    // Choose which values put into the table should be successfully found
    let tableInput = dataGenerator.generateSsnArray(dataSize);

    let containedQueries = [];
    for (let i = 0; i < queriesInTable; i++) {
      const randVal = Math.floor(Math.random() * dataSize);
      containedQueries.push(tableInput[randVal]);
    }

    // Choose what the contained queries' indexes will be in the query
    let containedIndexes = [];
    for (let i = 0; i < queriesInTable; i++) {
      let randVal = Math.floor(Math.random() * numberOfQueries);
      while (containedIndexes.includes(randVal)) {
        randVal = Math.floor(Math.random() * numberOfQueries);
      }
      containedIndexes.push(randVal);
    }
    containedIndexes.sort(function (a, b) { return a - b });

    let queryList = [];
    for (const [i, containedIndex] of containedIndexes.entries()) {
      if (i != 0) {
        queryList = queryList.concat(dataGenerator.generateSsnArray(containedIndex - containedIndexes[i - 1] - 1));
      } else {
        queryList = queryList.concat(dataGenerator.generateSsnArray(containedIndex));
      }
      queryList.push(containedQueries[i]);
    }

    let option = JSON.parse(defaultOptions);
    option.url = dataDomains[0] + '/listcreator/computeAndSendShares';
    option.data.input = tableInput;
    option.data.cpDomains = cpDomains;

    await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });

    option.url = dataDomains[1] + '/queryList/checkIfInList';
    option.method = 'GET';
    option.data.input = queryList;
    option.data.dataDomain = dataDomains[0];

    const result = await axios(option)
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
      });

    expect(result).toEqual(containedIndexes);
    done();
  });
});

/* */
