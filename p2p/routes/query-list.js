require('dotenv').config();

const express = require('express');
const router = express.Router();
const axios = require('axios');
const OPRF = require('oprf');
const config = require('config');

let encodeType = config.encodeType;
let port = config.port;
let holderDomain = config.serverDomain;
const oprf = new OPRF();

/**
 * @swagger
 * tags:
 *   name: Query List
 *   description: Extracting information from another list holder
 */

/**
 * Masks with querier's key and sends those values to be masked by the list holder, then unmasks data with querier's key
 * @param  {String[]} input - Plaintext data to be masked and sent to list holder
 * @param  {String} key - Encoded querier's key
 * @param  {String} secret - Secret shared by querier and holder
 * @returns {String[]} Encoded values of the input raised to only the list holder's key
 */
async function maskWithHolderKey(input, key, secret) {
  await oprf.ready

  key = oprf.decodePoint(key, encodeType);
  const data = input.map(entry => {
    const maskedValue = oprf.scalarMult(oprf.hashToPoint(entry), key);
    return oprf.encodePoint(maskedValue, encodeType);
  });

  const options = {
    method: 'GET',
    url: config.protocol + '://' + holderDomain + '/listholder/raiseToKey',
    data:
    {
      input: data,
      secret: secret
    },
    responseType: 'json'
  };

  // send to list holder
  return axios(options)
    .then(function (response) {
      const result = response.data.map(entry => {
        return oprf.encodePoint(oprf.unmaskPoint(oprf.decodePoint(entry, encodeType), key), encodeType);
      });

      return result;
    })
    .catch(function (error) {
      console.log(error);
    });
}

/**
 * @swagger
 * path:
 *  /querylist/checkIfInList:
 *    get:
 *      summary: Checks if entries in input are entries in a list held by another listholder and returns indexes of those that are
 *      tags: [Query List]
 *      parameters:
 *       - in: body
 *         name: Query-Array
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - secret
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *               description: Key to raise data to before sending to list holder
 *             secret:
 *               type: string
 *               description: Secret value shared between querier and list holder
 *             display:
 *               type: boolean
 *               description: Whether or not to display the values sent to the list holder
 *           example:
 *             input: [ "748320512", "002381635", "129427809", ... ]
 *             secret: "23449023"
 *             display: true
 *      responses:
 *        "200":
 *          description: Holder's list was successfully searched
 *          schema:
 *           type: array
 *           items:
 *             type: int
 *             description: indexes of input values that were found in the other list
 *           example:
 *             [ 9, 43, 210, 311 ]
 */
router.get('/checkIfInList', (req, res, next) => {
  const input = req.body.input;
  const secret = req.body.secret;

  oprf.ready.then(async function () {

    const key = oprf.generateRandomScalar();

    const maskedInput = await maskWithHolderKey(input, oprf.encodePoint(key, encodeType), secret, req.body.display);

    // axios(options)
    // .then(function (maskedInput) {
    let options = {
      method: 'GET',
      url: config.protocol + '://' + holderDomain + '/listholder/listdata',
      data: { 'secret': secret },
      responseType: 'json'
    };

    axios(options)
      .then(function (tableData) {
        let unionIndexes = [];

        for (const [index, queryVal] of maskedInput.entries()) {
          for (let entry of tableData.data) {

            if (entry === queryVal) {
              unionIndexes.push(index);
              break;
            }
          }
        }

        res.status(200).send(unionIndexes);
      })
      .catch(function (error) {
        console.log(error);
      });
  });

});

module.exports = {
  router:router,
  maskWithHolderKey:maskWithHolderKey
}
