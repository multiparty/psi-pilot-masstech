/**
 * @jest-environment node
 */
require('dotenv').config();

const axios = require('axios');
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');
const fs = require('fs');
const OPRF = require('oprf');
const { describe } = require('yargs');

const oprf = new OPRF();
const holderKey = process.env.KEY;
const encodeType = process.env.ENCODE_TYPE;

const testFileName = 'test-table';
for (let i = 0; i < 10; i++) {
  if (fs.existsSync('./p2p/' + testFileName + i.toString() + '.csv')) {
    fs.unlinkSync('./p2p/' + testFileName + i.toString() + '.csv');
  }
}

var options = {
  method: 'PUT',
  url: 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname',
  headers:
  {
    'cache-control': 'no-cache',
    Connection: 'keep-alive',
    Host: process.env.OTHER_DOMAIN,
    'Postman-Token': 'f9f97789-280b-4d17-85a2-7b520ece8a52,1512912b-6a13-4abd-8235-99cdc1b62ee8',
    'Cache-Control': 'no-cache',
    Accept: '*/*',
    'User-Agent': 'PostmanRuntime/7.20.1',
    'Content-Type': 'application/json',
    Authorization: 'Bearer 6AQnIyMC6jUeNkE4eGvqW7BSOpdLrEvp4bIgmmsN_3Vgc8tABwNQ9QHmsMavZ5Z9ZWzgoLrx30tCEXxZyLFxtbUZlBmSFrYWxhOZspIXByZJoCC-geQi1fkAXCCuXXYx'
  },
  data: { input: [{}] },
  responseType: 'json'
};

test('Table is of the proper size', done => {
  oprf.ready.then(function () {
    const dataSize = 100;

    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.data = { fileName: testFileName + '1' };

    // Change name of test file
    axios(options)
      .then(function (response) {
        options.method = 'POST';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/objectUpdate';
        options.data = { input: dataGenerator.generateData(dataSize, true) }

        axios(options)
          .then(function (response) {
            options.method = 'GET';
            options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
            options.data = { secret: process.env.SHARED };

            axios(options)
              .then(function (tableData) {
                expect(tableData.data.length).toBe(dataSize);
                done();
              })
              .catch(function (error) {
                console.log(error);
              });
          })
          .catch(function (error) {
            console.log(error);
          });
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});


test('List holder writes a single entry properly', done => {
  oprf.ready.then(function () {
    const input = dataGenerator.generateData(1, true);

    options.method = 'PUT';
    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.data = { fileName: testFileName + '2' };
    // Change name of test file
    axios(options)
      .then(function (response) {
        options.method = 'POST';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/singleUpdate';
        options.data = { input: input[0].ssn };

        axios(options)
          .then(function (response) {
            options.method = 'GET';
            options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
            options.data = { secret: process.env.SHARED };

            // Get the contents of the table
            axios(options)
              .then(function (tableData) {
                const hashedKey = oprf.hashToPoint(holderKey);
                const hashedInput = oprf.scalarMult(oprf.hashToPoint(input[0].ssn), hashedKey);

                expect(hashedInput).toEqual(oprf.decodePoint(tableData.data[0], encodeType));
                done();
              })
              .catch(function (error) {
                console.log(error);
              });
          })
          .catch(function (error) {
            console.log(error);
          });
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});

test('List holder writes many entries properly', done => {
  oprf.ready.then(function () {
    const dataSize = 1000;
    const input = dataGenerator.generateData(dataSize, true);

    options.method = 'PUT';
    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.data = { fileName: testFileName + '3' };
    // Change name of test file
    axios(options)
      .then(function (response) {
        options.method = 'POST';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/objectUpdate';
        options.data = { input: input };

        axios(options)
          .then(function (response) {
            options.method = 'GET';
            options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
            options.data = { secret: process.env.SHARED };

            // Get the contents of the table
            axios(options)
              .then(function (tableData) {
                const hashedKey = oprf.hashToPoint(holderKey);

                const hashedInput = input.map(entry => {
                  return oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(entry.ssn), hashedKey), encodeType);
                });

                expect(hashedInput).toEqual(tableData.data);
                done();
              })
              .catch(function (error) {
                console.log(error);
              });
          })
          .catch(function (error) {
            console.log(error);
          });
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});

test('/listholder/listdata returns error on wrong secret', done => {
  options.method = 'GET';
  options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
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
  options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/raiseToKey';
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


test('Proper value is returned from querylist/maskWithHolderKey', done => {
  return oprf.ready.then(async function () {
    const dataSize = 1000;
    const queryKey = oprf.generateRandomScalar();

    let input = dataGenerator.generateData(dataSize, true);

    input = input.map(x => x.ssn);

    options.method = 'GET';
    options.url = 'http://' + process.env.OTHER_DOMAIN + '/querylist/maskWithHolderKey';
    options.data = { input: input, key: oprf.encodePoint(oprf.hashToPoint(queryKey), encodeType), secret: process.env.SHARED };

    axios(options)
      .then(function (maskedInput) {
        const correct = input.map(x => oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(x), oprf.hashToPoint(holderKey)), encodeType));

        expect(maskedInput.data).toEqual(correct);
        done();
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});

test('querylist/checkIfInList properly returns indexes of values in table', done => {
  return oprf.ready.then(async function () {
    const dataSize = 1000;
    const queriesInTable = 12;
    const numberOfQueries = 100;

    const queryKey = oprf.generateRandomScalar();

    let tableInput = dataGenerator.generateData(dataSize, true);

    options.method = 'PUT';
    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.data = { fileName: testFileName + '4' };
    // Change name of test file
    axios(options)
      .then(function (response) {
        options.method = 'POST';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/objectUpdate';
        options.data = { input: tableInput };

        axios(options)
          .then(function (response) {
            // Choose which values put into the table should be successfully found
            let containedQueries = [];
            for (let i = 0; i < queriesInTable; i++) {
              const randVal = Math.floor(Math.random() * dataSize);
              containedQueries.push(tableInput[randVal].ssn);
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

            options.method = 'GET';
            options.url = 'http://' + process.env.OTHER_DOMAIN + '/querylist/checkIfInList/';
            options.data = { input: queryList, secret: process.env.SHARED };

            axios(options)
              .then(function (result) {
                expect(result.data).toEqual(containedIndexes);
                done();
              })
              .catch(function (error) {
                console.log(error);
              });
          })
          .catch(function (error) {
            console.log(error);
          });
      })
      .catch(function (error) {
        console.log(error);
      });
  });
});

