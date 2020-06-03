require('dotenv').config()

const OPRF = require('oprf');
const fs = require('fs');
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');


/**
 * Masks a single input with an environment key, and appends it to a table of masked data.
 * @param  {string} input - data to be masked and stored in the file
 * @param  {string} fileName - name of the file to add the input to
 */
function maskAndStoreInput(input, fileName) {
  const oprf = new OPRF();
  oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    const dataToStore = oprf.scalarMult(oprf.hashToPoint(input), key);
    const encodedData = oprf.encodePoint(dataToStore, 'UTF-8');

    fs.appendFileSync(fileName, encodedData + '\n');

  })
}

/**
 * Masks an array of string data entries with an environment key, and appends each to a table of masked data.
 * @param  {string[]} input - array of strings to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreArray(input, fileName) {
  input.forEach(entry => {
    maskAndStoreInput(entry, fileName);
  });
}

/**
 * Takes an array of objects and masks and appends the ssn property of each to a table of masked data.
 * @param  {object[]} input - array of objects to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreObjects(input, fileName) {
  let stringInput = [];
  input.forEach(entry => {
    stringInput.push(entry.ssn);
  });

  maskAndStoreArray(stringInput, fileName);
}

/**
 * Raises every entry in an array to A's key, and returns the raised values. Returns 403 error if shared secret does not match.
 * @param  {string[]} input - entries to be raised to A's key
 * @param  {string} secret - shared secret between requesting and receiving parties
 * @returns {string[]}
 */
function raiseToKey(input, secret) {
  if (secret === process.env.SHARED) {
    const oprf = new OPRF();

    let sendBack = oprf.ready.then(function () {
      const key = oprf.hashToPoint(process.env.KEY);

      let result = [];

      input.forEach(entry => {
        const maskedValue = oprf.scalarMult(oprf.hashToPoint(entry), key)
        result.push(oprf.encodePoint(maskedValue, 'UTF-8'));
      });

      return result;
    });

    return sendBack;
  } else {
    return "Error 403";
  }
}

/**
 * Returns a list of all the masked data stored in receiver's table.
 * @param  {string} secret - shared secret between requesting and receiving parties
 * @param {string} fileName - path to data table file
 * @returns {string[]}
 */
function queryTable(secret, fileName) {

  if (secret === process.env.SHARED) {
    const tableData = fs.readFileSync(fileName).toString().split("\n");

    return tableData;
  } else {
    return "Error 403";
  }
}

const data = dataGenerator.generateData(50, false);
var input = [];
data.forEach(entry => {
  input.push(entry.ssn);
});

(async () => {
  //var output = await maskAndStoreArray(input, "table.txt");
  queryTable(process.env.SHARED, 'table.txt');
})();
