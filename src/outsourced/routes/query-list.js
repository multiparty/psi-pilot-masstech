require('dotenv').config();

const express = require('express');
const router = express.Router();
const axios = require('axios');
const OPRF = require('oprf');
const config = require('config');

let encodeType = 'ASCII';
const oprf = new OPRF();

/**
 * Makes a request to one of the compute parties in order to get the stored list data
 * @param  {String} dataDomain Domain of creator whose list data will be gotten from
 * @param {String} cpDomain Compute party domain to get list from
 * @returns {String[]} Values that were stored in dataDomain's list
 */
async function getTableData(dataDomain, cpDomain) {
  var options = {
    method: 'GET',
    url: cpDomain + '/computeparty/listData',
    data:
      {
        dataDomain: dataDomain
      },
    responseType: 'json'
  };

  const result = axios(options)
    .then(function (response) {

      return response.data;
    })
    .catch(function (error) {
      console.log(error);
    });

  return result;
}

/**
 * Creates shares out of the input and sends them to compute parties to be raised to their keys and resummed
 * @param  {String[]} input Plaintext data to be checked against dataDomain's list
 * @param  {String[]} cpDomains Domains of all compute parties involved in the calculation of dataDomain's list
 * @param  {String} dataDomain Domain of creator whose list is being queried
 * @returns {Object} Returns the shares that were calculated originally, and the results of having the compute parties raise them to their keys and sum them.
 */
async function computeAndSendShares(input, cpDomains, dataDomain) {

  await oprf.ready;

  let result = [];
  for (let i = 0; i < input.length; i++) {
    const hashedInput = oprf.hashToPoint(input[i]);

    let elementShares = [];
    for (let j = 0; j < cpDomains.length - 1; j++) {
      elementShares.push(oprf.generateRandomScalar());
    }

    // TODO: use new oprf functions for addition and subtraction
    let shareSum = new Uint8Array(32);
    elementShares.map((value, index) => {
      shareSum = oprf.sodium.crypto_core_ristretto255_add(shareSum, value);
    });

    const finalShare = oprf.sodium.crypto_core_ristretto255_sub(hashedInput, shareSum);

    let end = oprf.sodium.crypto_core_ristretto255_add(shareSum, finalShare);

    elementShares.push(finalShare);
    // result is a list of the original pieces of data, and each index is a list of that data's shares
    result.push(elementShares);
  }

  let shares = [];
  // First Compute Party should be sent the first share for each piece of data
  for (let cpIndex = 0; cpIndex < cpDomains.length; cpIndex++) {
    let cpShare = [];
    for (let dataIndex = 0; dataIndex < result.length; dataIndex++) {
      cpShare.push(oprf.encodePoint(result[dataIndex][cpIndex], encodeType));
    }
    shares.push(cpShare);
  }

  let options = [];

  // Possibly send some unique key for these requests to ensure that they're the same request
  var defaultOptions = {
    'method': 'GET',
    'url': dataDomain,
    data:
      {},
    responseType: 'json'
  };

  // Need to stringify in order to clone the object
  defaultOptions = JSON.stringify(defaultOptions);

  cpDomains.forEach((domain, i) => {
    const option = JSON.parse(defaultOptions);
    option.url = domain + "/computeparty/computeFromShares";
    option.domain = domain;
    option.data.input = shares[i];
    option.data.dataDomain = dataDomain;
    option.data.isUpdate = false;
    options.push(option);
  });

  const requests = options.map(option => {
    return axios(option);
  });

  const results = await axios.all(requests)
    .then(axios.spread((...responses) => {

      const data = responses.map(response => {
        return response.data;
      });

      return data;
    }))
    .catch(function (error) {
      console.log(error);
    });

  return {"shares": shares, "results": results};
};

/**
 * @swagger
 * tags:
 *   name: Query List
 *   description: Queries compute parties about list data
 */

/**
 * @swagger
 * path:
 *  /querylist/checkIfInList:
 *    get:
 *      summary: Finds the intersection between the input and a specified list creator's list
 *      tags: [Query List]
 *      parameters:
 *       - in: body
 *         name: Query-Data
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - dataDomain
 *            - cpDomains
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Plaintext information to be checked if it is in the specified list
 *             dataDomain:
 *               type: string
 *               description: Domain of the creator whose list should be queried
 *             cpDomains:
 *               type: string
 *               description: Domains of all of the compute parties used to create the specified list
 *           example:
 *             input: [ "198488954", "654823719", "495782631", ... ]
 *             dataDomain: "http://localhost:8000"
 *             cpDomains: [ "http://localhost:3000", "http://localhost:3001", "http://localhost:3002" ]
 *      responses:
 *        "200":
 *          description: Values were raised to compute party's key
 *          schema:
 *            type: array
 *            items:
 *              type: int
 *              description: indexes of the values of input that were found in the list
 *            example:
 *              [ 22, 43, 188, 212, ... ]
 */
router.get('/checkIfInList', async (req, res, next) => {
  const input = req.body.input;
  const cpDomains = req.body.cpDomains;
  const dataDomain = req.body.dataDomain;

  const maskedInput = (await computeAndSendShares(input, cpDomains, dataDomain)).results[0];

  const tableData = await getTableData(dataDomain, config.computePartyDomains[0]);

  let unionIndexes = [];

  for (const [index, queryVal] of maskedInput.entries()) {
    for (let entry of tableData) {

      if (entry === queryVal) {
        unionIndexes.push(index);
        break;
      }
    }
  }

  res.status(200).json(unionIndexes);
});


module.exports = {
  router: router,
  computeAndSendShares: computeAndSendShares,
  getTableData: getTableData
}
