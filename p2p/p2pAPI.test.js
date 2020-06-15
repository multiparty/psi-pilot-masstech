require('dotenv').config();

const request = require("request");
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');
const fs = require('fs');
const OPRF = require('oprf');

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
  body: { input: [{}] },
  json: true
};

test('Table is of the proper size', done => {
  oprf.ready.then(function () {
    const dataSize = 100;

    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.body = { fileName: testFileName + '1' };

    // Change name of test file
    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      options.method = 'POST';
      options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/objectUpdate';
      options.body = { input: dataGenerator.generateData(dataSize, true) }

      request(options, function (error, response, body) {
        if (error) throw new Error(error);

        options.method = 'GET';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
        options.body = { secret: process.env.SHARED };

        request(options, function (error, response, tableData) {
          if (error) throw new Error(error);

          expect(tableData.length).toBe(dataSize);
          done();
        });
      });
    });
  });
});


test('List holder writes a single entry properly', done => {
  oprf.ready.then(function () {
    const input = dataGenerator.generateData(1, true);

    options.method = 'PUT';
    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.body = { fileName: testFileName + '2' };
    // Change name of test file
    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      options.method = 'POST';
      options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/singleUpdate';
      options.body = { input: input[0].ssn };

      request(options, function (error, response, body) {
        if (error) throw new Error(error);

        options.method = 'GET';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
        options.body = { secret: process.env.SHARED };

        // Get the contents of the table
        request(options, function (error, response, tableData) {
          if (error) throw new Error(error);

          const hashedKey = oprf.hashToPoint(holderKey);
          const hashedInput = oprf.scalarMult(oprf.hashToPoint(input[0].ssn), hashedKey);

          expect(hashedInput).toEqual(oprf.decodePoint(tableData[0], encodeType));
          done();
        });
      });
    });
  });
});

test('List holder writes many entries properly', done => {
  oprf.ready.then(function () {
    const dataSize = 1000;
    const input = dataGenerator.generateData(dataSize, true);

    options.method = 'PUT';
    options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listname/';
    options.body = { fileName: testFileName + '3' };
    // Change name of test file
    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      options.method = 'POST';
      options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/objectUpdate';
      options.body = { input: input };

      request(options, function (error, response, body) {
        if (error) throw new Error(error);

        options.method = 'GET';
        options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
        options.body = { secret: process.env.SHARED };

        // Get the contents of the table
        request(options, function (error, response, tableData) {
          if (error) throw new Error(error);

          const hashedKey = oprf.hashToPoint(holderKey);

          const hashedInput = input.map(entry => {
            return oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(entry.ssn), hashedKey), encodeType);
          });

          expect(hashedInput).toEqual(tableData);
          done();
        });
      });
    });
  });
});

test('/listholder/listdata returns error on wrong secret', done => {
  options.method = 'GET';
  options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
  options.body = { secret: 'wrong secret' };

  request(options, function (error, response, tableData) {
    if (error) throw new Error(error);

    expect(response.statusCode).toBe(403);
    done();
  });
});

test('/listholder/raiseToKey returns error on wrong secret', done => {
  options.method = 'GET';
  options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/raiseToKey';
  options.body = { input: ['1234'], secret: 'wrong secret' };

  request(options, function (error, response, tableData) {
    if (error) throw new Error(error);

    expect(response.statusCode).toBe(403);
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
    options.body = { input: input, key: oprf.encodePoint(oprf.hashToPoint(queryKey), encodeType), secret: process.env.SHARED };

    request(options, function (error, response, maskedInput) {
      const correct = input.map(x => oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(x), oprf.hashToPoint(holderKey)), encodeType));

      expect(maskedInput).toEqual(correct);
      done();
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
    options.body = { fileName: testFileName + '4' };
    // Change name of test file
    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      options.method = 'POST';
      options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/objectUpdate';
      options.body = { input: tableInput };

      request(options, function (error, response, body) {
        if (error) throw new Error(error);

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
        options.body = { input: queryList, secret: process.env.SHARED };

        request(options, function (error, response, result) {

          expect(result).toEqual(containedIndexes);
          done();
        });
      });
    });
  });
});
