const dataGenerator = require('./data-generator');
const ingest = require('./ingest');
const fs = require('fs');

const DATA_SIZE = 10000;

test('Generated data is proper length', async () => {
  const data = dataGenerator.generateData(DATA_SIZE, false);
  expect(data.length).toBe(DATA_SIZE);
});

test('Data written to csv file is properly read back', async () => {
  const data = dataGenerator.generateData(DATA_SIZE, true);

  const ingestData = ingest.readCsv('generated-data.csv');

  expect(data).toEqual(ingestData);
});

test('Reading after writing twice only yields the second write\'s data', async () => {
  let data = dataGenerator.generateData(DATA_SIZE, true);

  data = dataGenerator.generateData(DATA_SIZE, true);

  const ingestData = ingest.readCsv('generated-data.csv');

  expect(data).toEqual(ingestData);
});


