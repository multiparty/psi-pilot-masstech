/**
 * @jest-environment node
 */
require('dotenv').config();

const axios = require('axios');
const dataGenerator = require('../utils/data-generator');
const queryList = require('./routes/query-list');
const listHolder = require('./routes/list-holder');
const fs = require('fs');
const OPRF = require('oprf');
const config = require('config');
const { describe } = require('yargs');

const oprf = new OPRF();
const holderKey = process.env.KEY;
const encodeType = config.encodeType;
const serverDomain = config.serverDomain;

const testFileName = config.fileName;

let options = {
  method: 'PUT',
  url: serverDomain,
  data: { input: [{}] },
  responseType: 'json'
};

// Make sure you are starting with a blank file
if (fs.existsSync('./p2p/' + testFileName)) {
  fs.unlinkSync('./p2p/' + testFileName);
}

test('Table is of the proper size', done => {
  oprf.ready.then(async function () {
    const dataSize = 100;

    const input = dataGenerator.generateSsnArray(dataSize);

    options.method = 'POST';
    options.url = serverDomain + '/listholder/arrayUpdate';
    options.data = { input: input };

    // Insert input into the table
    await axios(options)
      .then(function (response) {
      })
      .catch(function (error) {
        console.log(error);
      });

    options.method = 'GET';
    options.url = serverDomain + '/listholder/listdata';
    options.data = { secret: process.env.SHARED };

    // Get the contents of the table
    axios(options)
      .then(function (tableData) {
        expect(tableData.data.length).toBe(dataSize);
        fs.unlinkSync('./p2p/' + testFileName);
        done();
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});

test('List holder writes many entries properly', done => {
  oprf.ready.then(async function () {
    const dataSize = 1000;
    const input = dataGenerator.generateSsnArray(dataSize);

    options.method = 'POST';
    options.url = serverDomain + '/listholder/arrayUpdate';
    options.data = { input: input };

    // Insert input into the table
    await axios(options)
      .then(function (response) {
      })
      .catch(function (error) {
        console.log(error);
      });

    options.method = 'GET';
    options.url = serverDomain + '/listholder/listdata';
    options.data = { secret: process.env.SHARED };

    // Get the contents of the table
    axios(options)
      .then(function (tableData) {
        const hashedKey = oprf.decodePoint(holderKey, encodeType);

        const hashedInput = input.map(entry => {
          return oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(entry), hashedKey), encodeType);
        });

        expect(hashedInput).toEqual(tableData.data);
        fs.unlinkSync('./p2p/' + testFileName);
        done();
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});


test('/listholder/listdata returns error on wrong secret', done => {
  options.method = 'GET';
  options.url = serverDomain + '/listholder/listdata';
  options.data = { secret: 'wrong secret' };

  axios(options)
    .then(function (response) {
      expect(response.statusCode).toBe(403);
      done();
    })
    .catch(function (error) {
      expect(error.request.res.statusCode).toBe(403);
      done();
    });
});

test('/listholder/raiseToKey returns error on wrong secret', done => {
  options.method = 'GET';
  options.url = serverDomain + '/listholder/raiseToKey';
  options.data = { input: ['1234'], secret: 'wrong secret' };

  axios(options)
    .then(function (response) {
      expect(response.statusCode).toBe(403);
      done();
    })
    .catch(function (error) {
      expect(error.request.res.statusCode).toBe(403);
      done();
    });
});


test('Proper value is returned from querylist/maskWithHolderKey', async (done) => {
  return oprf.ready.then(async function () {
    const dataSize = 10;
    const queryKey = oprf.generateRandomScalar();

    let input = dataGenerator.generateData(dataSize, true);

    input = input.map(x => x.ssn);

    const maskedInput = await queryList.maskWithHolderKey(input, oprf.encodePoint(queryKey, encodeType), process.env.SHARED);

    const correct = input.map(x => oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(x), oprf.decodePoint(holderKey, encodeType)), encodeType));

    expect(maskedInput).toEqual(correct);
    done();
  });
});

test('querylist/checkIfInList properly returns indexes of values in table', done => {
  return oprf.ready.then(async function () {
    const dataSize = 30;
    const queriesInTable = 5;
    const numberOfQueries = 10;

    const queryKey = oprf.generateRandomScalar();

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

    options.method = 'POST';
    options.url = serverDomain + '/listholder/arrayUpdate';
    options.data = { input: tableInput };

    // Create a list for the data in tableInput
    await axios(options)
      .then(function (response) {
      })
      .catch(function (error) {
        console.log(error);
      });

    options.method = 'GET';
    options.url = 'http://localhost:' + process.env.PORT + '/querylist/checkIfInList/';
    options.data = { input: queryList, secret: process.env.SHARED };

    // Call the client-side API to do a search of the table
    axios(options)
      .then(function (result) {
        expect(result.data).toEqual(containedIndexes);
        fs.unlinkSync('./p2p/' + testFileName);
        done();
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});
