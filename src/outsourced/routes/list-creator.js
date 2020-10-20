const express = require('express');
const router = express.Router();
const OPRF = require('oprf');

const axios = require('axios');
const config = require('config');

const encodeType = 'ASCII';
const oprf = new OPRF();

/**
 * @swagger
 * tags:
 *   name: List Creator
 *   description: Creating and updating lists
 */

/**
 * @swagger
 * path:
 *  /listcreator/computeAndSendShares:
 *    post:
 *      summary: Divides a list of input into shares and distributes it to compute parties for them to create/update their list
 *      tags: [List Creator]
 *      parameters:
 *       - in: body
 *         name: Compute-And-Send-Shares
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - cpDomains
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: SSNs to be appended to list
 *             cpDomains:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Domains of all of the compute parties
 *           example:
 *             input: [ "123456789", "987654321", "443256598" ]
 *             cpDomains: [ "http://localhost:3000", "http://localhost:3001" ]
 *      responses:
 *        "200":
 *          description: Values were calculated correctly
 *          schema:
 *            type: object
 *            properties:
 *              shares:
 *                type: string
 *                description: The shares created by the list creator and sent out to the compute parties
 *              results:
 *                type: string
 *                description: Final sum of the shares raised to every CP's key
 */
router.post('/computeAndSendShares', async (req, res, next) => {
  const input = req.body.input;
  const cpDomains = req.body.cpDomains;

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
  let defaultOptions = {
    'method': 'GET',
    'url': config.domain,
    data:
      {},
    responseType: 'json'
  };

  // Need to stringify in order to clone the object
  defaultOptions = JSON.stringify(defaultOptions);

  cpDomains.forEach((domain, i) => {
    let option = JSON.parse(defaultOptions);
    option.url = domain + '/computeparty/computeFromShares';
    option.domain = domain;
    option.data.input = shares[i];
    option.data.dataDomain = config.domain;
    option.data.isUpdate = true;
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

  res.status(200).json({'shares': shares, 'results': results});
});

module.exports = {
  router: router
}
