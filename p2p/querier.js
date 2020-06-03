require('dotenv').config()

const listHolder = require('./list-holder');
const OPRF = require('oprf');


/**
 * Raises entries to a key, and then sends entries to the list holder for them to raise to their key
 * @param  {string[]} input - entries (SSNs) to be raised to key and then sent to list holder
 * @param  {string} key - Key to raise all entries to
 * @param {string} secret - Shared secret between querier and list holder
 * @returns {string[]} encoded entries of input now raised to both querier's and list holder's keys
 */
function sendToListHolder(input, key, secret) {
  const oprf = new OPRF();
  let result = oprf.ready.then(function () {

    let data = [];

    input.forEach(entry => {
      const maskedValue = oprf.scalarMult(oprf.hashToPoint(entry), key)
      data.push(oprf.encodePoint(maskedValue, 'UTF-8'));
    });

    return listHolder.raiseToKey(data, secret);
  });
  return result;
}




function getAndDecodeTable(key, secret) {
  const oprf = new OPRF();
  let result = oprf.ready.then(function () {
    const table = listHolder.queryTable(secret, 'table.txt');
    let decodedTable = []

    // Decode all table entries to points
    table.forEach(entry => {
      decodedTable.push(oprf.decodePoint(entry, 'UTF-8'));
    });

    return decodedTable;
  });
  return result;
}




const oprf = new OPRF();
oprf.ready.then(async function () {
  const key = oprf.generateRandomScalar();
  const secret = process.env.SHARED;
  let input = ["12314", "12433"];
  let holderResponse = await sendToListHolder(input, key, secret);
  console.log(holderResponse);

  // decode holder's response
  let decodedResponse = []
  holderResponse.forEach(entry => {
    decodedResponse.push(oprf.decodePoint(entry, 'UTF-8'));
  });

  const table = await getAndDecodeTable(key, secret);

  console.log(decodedResponse);

  console.log(table);

});




