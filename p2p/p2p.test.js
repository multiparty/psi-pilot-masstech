require('dotenv').config()

const listHolder = require('./list-holder');
const querier = require('./querier');
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');

const fs = require('fs');
const OPRF = require('oprf');

const oprf = new OPRF();
const key = process.env.KEY;
const encodeType = 'ASCII'

const testFileName = 'test-table';
for (let i = 0; i < 10; i++) {
  if (fs.existsSync(testFileName + i.toString() + '.csv')) {
    fs.unlinkSync(testFileName + i.toString() + '.csv');
  }
}




test('Table is of the proper size', () => {
  return oprf.ready.then(async function () {
    const dataSize = 100;

    await listHolder.maskAndStoreObjects(dataGenerator.generateData(dataSize, true), testFileName + '1.csv');

    const tableData = listHolder.queryTable(process.env.SHARED, testFileName + '1.csv');

    expect(tableData.length).toBe(dataSize);
  });
});

test('List holder writes a single entry properly', () => {
  return oprf.ready.then(async function () {
    const input = dataGenerator.generateData(1, true);

    await listHolder.maskAndStoreInput(input[0].ssn, testFileName + '2.csv');

    const tableData = listHolder.queryTable(process.env.SHARED, testFileName + '2.csv');

    const hashedKey = oprf.hashToPoint(key);

    const hashedInput = oprf.scalarMult(oprf.hashToPoint(input[0].ssn), hashedKey);

    expect(hashedInput).toEqual(oprf.decodePoint(tableData[0], encodeType));
  });
});

test('List holder writes many entries properly', () => {
  return oprf.ready.then(async function () {
    const dataSize = 1000;

    const input = dataGenerator.generateData(dataSize, true);

    await listHolder.maskAndStoreObjects(input, testFileName + '3.csv');

    const tableData = listHolder.queryTable(process.env.SHARED, testFileName + '3.csv');

    const hashedKey = oprf.hashToPoint(key);

    let hashedInput = [];
    input.forEach(entry => {
      hashedInput.push(oprf.encodePoint(oprf.scalarMult(oprf.hashToPoint(entry.ssn), hashedKey), encodeType));
    })

    let decodedData = [];
    tableData.forEach(entry => {
      decodedData.push(oprf.decodePoint(entry, encodeType));
    });

    expect(hashedInput).toEqual(tableData);
  });
});

test('queryTable throws returns error on wrong secret', () => {
  expect(listHolder.queryTable(['12345'], 'wrong secret')).toEqual('Error 403');
});

test('raiseToKey throws returns error on wrong secret', async () => {
  expect(await listHolder.raiseToKey(['12345'], 'wrong secret')).toEqual('Error 403');
});

test('Proper value is returned from raiseToKey and sendToListHolder', () => {
  return oprf.ready.then(async function () {
    const dataSize = 100;
    const queryKey = oprf.generateRandomScalar();

    let input = dataGenerator.generateData(dataSize, true);

    input = input.map(x => x.ssn);

    const maskedInput = await querier.sendToListHolder(input, queryKey, process.env.SHARED);

    // sendToListHolder should get us the SSNs masked by A's key
    const correct = input.map(x => oprf.scalarMult(oprf.hashToPoint(x), oprf.hashToPoint(key)));

    expect(maskedInput).toEqual(correct);
  });
});

test('checkEntriesInTable properly returns indexes of values in table', () => {
  return oprf.ready.then(async function () {
    const dataSize = 1000;
    const queriesInTable = 12;
    const numberOfQueries = 100;

    const queryKey = oprf.generateRandomScalar();

    let tableInput = dataGenerator.generateData(dataSize, true);

    await listHolder.maskAndStoreObjects(tableInput, testFileName + '4.csv');

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

    const result = await querier.checkEntriesInTable(queryList, process.env.SHARED, testFileName + '4.csv');

    expect(result).toEqual(containedIndexes);
  });
});
