require('dotenv').config()

const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const OPRF = require('oprf');
const fs = require('fs');
const ingest = require('../utils/ingest');

const encodeType = 'UTF-8';

const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
  ]
});


/**
 * Masks a single input with a stored key, and appends it to a table of masked data.
 * @param  {string} input - SSN to be masked and stored in the file
 * @param  {string} fileName - name of the file to add the input to
 */
function maskAndStoreInput(input, fileName) {
  const oprf = new OPRF();
  return oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    const maskedData = oprf.scalarMult(oprf.hashToPoint(input), key);
    const encodedData = oprf.encodePoint(maskedData, encodeType);
    let dataToWrite = [];
    let testObject = {};
    testObject.ssn = encodedData;
    dataToWrite.push(testObject);

    let header = "";
    if(!fs.existsSync(fileName)){
      header = csvStringifier.getHeaderString();
    }

    const body = csvStringifier.stringifyRecords(dataToWrite);
    fs.appendFileSync(fileName, header + body);
  });
}

/**
 * Masks an array of SSNs with an environment key, and appends each to a table of masked data.
 * @param  {string[]} input - array of SSNs to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreArray(input, fileName) {
  const oprf = new OPRF();
  return oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    let dataToWrite = [];
    input.forEach(entry => {
      const maskedEntry = oprf.scalarMult(oprf.hashToPoint(entry), key);
      const encodedEntry = oprf.encodePoint(maskedEntry, encodeType);
      dataToWrite.push({'ssn': encodedEntry});
    })

    console.log("Data: ")
    console.log(dataToWrite);

    let header = "";
    if(!fs.existsSync(fileName)){
      header = csvStringifier.getHeaderString();
    }

    const body = csvStringifier.stringifyRecords(dataToWrite);
    console.log("Written: "+header+body);
    fs.appendFileSync(fileName, header + body);
  });
}

/**
 * Takes an array of objects and masks their ssn property and appends it to a table of masked data.
 * @param  {object[]} input - array of objects to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreObjects(input, fileName) {
  const oprf = new OPRF();
  return oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    let dataToWrite = [];
    input.forEach(entry => {
      const maskedEntry = oprf.scalarMult(oprf.hashToPoint(entry.ssn), key);
      const encodedEntry = oprf.encodePoint(maskedEntry, encodeType);
      dataToWrite.push({'ssn': encodedEntry});
    })

    let header = "";
    if(!fs.existsSync(fileName)){
      header = csvStringifier.getHeaderString();
    }

    const body = csvStringifier.stringifyRecords(dataToWrite);
    fs.appendFileSync(fileName, header + body);
  });
}

/**
 * Raises every entry in an array to A's key, and returns the raised values. Returns 403 error if shared secret does not match.
 * @param  {string[]} input - Encoded entries to be raised to A's key
 * @param  {string} secret - shared secret between requesting and receiving parties
 * @returns {string[]}
 */
function raiseToKey(input, secret) {
  if (secret === process.env.SHARED) {
    const oprf = new OPRF();

    let result = oprf.ready.then(function () {
      const key = oprf.hashToPoint(process.env.KEY);

      let data = [];

      input.forEach(entry => {
        const maskedValue = oprf.scalarMult(oprf.decodePoint(entry, encodeType), key)
        data.push(oprf.encodePoint(maskedValue, encodeType));
      });

      return data;
    });
    return result;
  } else {
    return "Error 403";
  }
}

/**
 * Returns a list of all the masked data stored in receiver's table.
 * @param  {string} secret - shared secret between requesting and receiving parties
 * @param {string} fileName - path to data table file
 * @returns {string[]} array of SSNs raised to list holder's key that are stored in the table file
 */
function queryTable(secret, fileName) {

  if (secret === process.env.SHARED) {
    const tableData = ingest.readCsv(fileName);

    let result = [];
    tableData.forEach(entry => {
      result.push(entry.ssn);
    })

    return result;
  } else {
    return "Error 403";
  }
}

exports.raiseToKey = raiseToKey;
exports.queryTable = queryTable;
exports.maskAndStoreObjects = maskAndStoreObjects;
