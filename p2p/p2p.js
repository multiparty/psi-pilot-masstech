require('dotenv').config()

const OPRF = require('oprf');
const fs = require('fs');
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');

/**
 * Masks a single input with an environment key, and appends it to a table of masked data
 * @param  {string} input - data to be masked and stored in the file
 * @param  {string} fileName - name of the file to add the input to
 */
function maskAndStoreInput(input, fileName) {
  var oprf = new OPRF();
  oprf.ready.then(function () {
    let key = oprf.hashToPoint(process.env.KEY);

    let dataToStore = oprf.scalarMult(oprf.hashToPoint(input), key);
    let encodedData = oprf.encodePoint(dataToStore, 'UTF-8');

    fs.appendFileSync(fileName, encodedData+'\n');

  })
}

/**
 * Masks an array of string data entries with an environment key, and appends each to a table of masked data
 * @param  {Array} input - array of strings to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreArray(input, fileName) {
  input.forEach(entry => {
    maskAndStoreInput(entry, fileName);
  });
}

/**
 * Takes an array of objects and masks and appends the ssn property of each to a table of masked data
 * @param  {Array} input - array of objects to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreObjects(input, fileName) {
  let stringInput = [];
  input.forEach(entry => {
    stringInput.push(entry.ssn);
  });

  maskAndStoreArray(stringInput, fileName);
}


(async () => {
  let data = await dataGenerator.generateSsnData(1,false);
  maskAndStoreInput(data[0].ssn, 'table.txt');
})();




