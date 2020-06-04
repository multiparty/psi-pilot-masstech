require('dotenv').config()

const listHolder = require('./list-holder');
const OPRF = require('oprf');

const encodeType = 'ASCII';

/**
 * Raises entries to a key, and then sends entries to the list holder for them to raise to their key
 * @param  {string[]} input - entries (SSNs) to be raised to key and then sent to list holder
 * @param  {string} key - querier's key to raise all entries to
 * @param {string} secret - shared secret between querier and list holder
 * @returns {Uint8Array[]} decoded entries of input now raised the list holder's key
 */
function sendToListHolder(input, key, secret) {
  const oprf = new OPRF();
  return oprf.ready.then(async function () {

    let data = [];

    input.forEach(entry => {
      const maskedValue = oprf.scalarMult(oprf.hashToPoint(entry), key)
      data.push(oprf.encodePoint(maskedValue, encodeType));
    });

    const encodedResponse = await listHolder.raiseToKey(data, secret);

    let result = [];
    // Decode and the unmask response with querier's key
    encodedResponse.forEach(entry => {
      result.push(oprf.unmaskPoint(oprf.decodePoint(entry, encodeType), key));
    });
    return result;
  });
}



/**
 * Requests the data from the list holder's table
 * @param  {string} secret - shared secret with list holder
 * @returns {Uint8Array[]} decoded data from the holder's table
 */
function getAndDecodeTable(secret) {
  const oprf = new OPRF();
  let result = oprf.ready.then(function () {
    const table = listHolder.queryTable(secret, 'table.csv');
    let decodedTable = []

    // Decode all table entries to points
    table.forEach(entry => {
      decodedTable.push(oprf.decodePoint(entry, encodeType));
    });

    return decodedTable;
  });
  return result;
}

/**
 * Checks if any of the specified SSNs are in a list holder's data table
 * @param  {string[]} input - list of SSNs to check against holder's table
 * @param  {string} secret - shared secret with list holder
 * @returns {int[]} list of indexes of input that were found in holder's table
 */
function checkEntriesInTable(input, secret) {
  const oprf = new OPRF();
  return oprf.ready.then(async function () {
    const key = oprf.generateRandomScalar();

    let maskedInput = await sendToListHolder(input, key, secret);

    const tableData = await getAndDecodeTable(secret);

    let unionIndexes = [];
    for (const [index, queryVal] of maskedInput.entries()) {
      for (let entry of tableData) {

        // Compare values stored in queryVal and entry which are Uint8Arrays
        const areEqual = queryVal.every(function(element, i) {
          return element == entry[i];
        });

        if (areEqual) {
          unionIndexes.push(index);
          break;
        }
      }
    }

    return unionIndexes;
  });
}
