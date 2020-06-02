require('dotenv').config()

const OPRF = require('oprf');
const fs = require('fs');
const dataGenerator = require('../utils/data-generator');
const ingest = require('../utils/ingest');

/**
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
 * @param  {Array} input - array of data to be masked and stored in the file
 * @param  {string} fileName - name of the file to append the data to
 */
function maskAndStoreList(input, fileName) {

}


(async () => {
  let data = await dataGenerator.generateSsnData(1,false);
  maskAndStoreInput(data[0].ssn, 'table.txt');
})();




