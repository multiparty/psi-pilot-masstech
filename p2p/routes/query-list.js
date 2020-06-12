require('dotenv').config();

const express = require('express');
const router = express.Router();
const request = require('request');
const OPRF = require('oprf');

// Set to ASCII encoding by default
let encodeType = 'ASCII';
let domain = 'localhost:3000';
let holderDomain = 'localhost:3000';
const oprf = new OPRF();

router.put('/setparams', (req, res, next) => {
  encodeType = req.body.encodeType;
  domain = req.body.domain;
  holderDomain = req.body.holderDomain;

  res.status(200).send("Encoding set to " + encodeType + ", domain set to " + domain + ", and holder domain set to " + holderDomain);
});

/**
 * @swagger
 * tags:
 *   name: Query List
 *   description: Extracting information from another list holder
 */

/**
 * @swagger
 * path:
 *  /querylist/maskWithHolderKey:
 *    get:
 *      summary: Masks with querier's key and sends those values to be masked by the list holder
 *      tags: [Query List]
 *      parameters:
 *       - in: body
 *         name: Query-Array
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - key
 *            - secret
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *               description: Plaintext data to be masked and sent to list holder
 *             key:
 *               type: string
 *               description: Key to raise data to before sending to list holder
 *             secret:
 *               type: string
 *               description: Secret value shared between querier and list holder
 *           example:
 *             input: [ "748320512", "002381635", "129427809", ... ]
 *             key: "56423091200"
 *             secret: "23449023"
 *      responses:
 *        "200":
 *          description: Entries were successfully appended to the list
 *          content:
 *            application/json:
 *              schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: array
 *                   items:
 *                     type: string
 *                     description: values raised to both the querier's and holder's key
 *               example:
 *                 result: [ "2341231" ]
 */
router.get('/maskWithHolderKey', (req, res, next) => {
  const input = req.body.input;
  let key = req.body.key;
  const secret = req.body.secret;

  oprf.ready.then(function () {
    key = oprf.decodePoint(key, encodeType);
    const data = input.map(entry => {
      const maskedValue = oprf.scalarMult(oprf.hashToPoint(entry), key);
      return oprf.encodePoint(maskedValue, encodeType);
    });

    console.log("Input: " + input);

    console.log("Data: ");
    console.log(data);

    var options = {
      method: 'GET',
      url: 'http://' + holderDomain + '/listholder/raiseToKey',
      headers:
      {
        'cache-control': 'no-cache',
        Connection: 'keep-alive',
        Host: holderDomain,
        'Cache-Control': 'no-cache',
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      body:
      {
        input: data,
        secret: secret
      },
      json: true
    };

    // send to list holder
    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      const result = body.map(entry => {
        return oprf.encodePoint(oprf.unmaskPoint(oprf.decodePoint(entry, encodeType), key), encodeType);
      });
      res.status(200).send(result);
    });
  });
});

// Might not be necessary, easier to just use encoded stuff
router.get('/getAndDecodeTable', async (req, res, next) => {
  const secret = req.body.secret;

  oprf.ready.then(function () {

    var options = {
      method: 'GET',
      url: 'http://' + holderDomain + '/listholder/listdata',
      headers:
      {
        'cache-control': 'no-cache',
        Connection: 'keep-alive',
        Host: holderDomain,
        'Cache-Control': 'no-cache',
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      body: { secret: secret },
      json: true
    };

    request(options, function (error, response, tableData) {
      if (error) throw new Error(error);

      const decodedTable = tableData.map(entry => {
        return oprf.decodePoint(entry, encodeType);
      });

      res.send(decodedTable);
    });
  });
});

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
 *           example:
 *             input: [ "748320512", "002381635", "129427809", ... ]
 *             secret: "23449023"
 *      responses:
 *        "200":
 *          description: Entries were successfully appended to the list
 *          content:
 *            application/json:
 *              schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: array
 *                   items:
 *                     type: int
 *                     description: indexes of input values that were found in the other list
 *               example:
 *                 result: [ 9, 43, 210, 311 ]
 */
router.get('/checkIfInList', (req, res, next) => {
  const input = req.body.input;
  const secret = req.body.secret;

  oprf.ready.then(function () {

    const key = oprf.generateRandomScalar();

    var options = {
      method: 'GET',
      url: 'http://' + domain + '/querylist/maskWithHolderKey',
      headers:
      {
        'cache-control': 'no-cache',
        Connection: 'keep-alive',
        Host: domain,
        'Cache-Control': 'no-cache',
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
      body:
      {
        input: input,
        key: oprf.encodePoint(key, encodeType),
        secret: secret
      },
      json: true
    };

    request(options, function (error, response, maskedInput) {
      if (error) throw new Error(error);

      options.url = 'http://' + holderDomain + '/listholder/listdata';
      options.body = { 'secret': secret };

      request(options, function (error, response, tableData) {
        if (error) throw new Error(error);

        let unionIndexes = [];
        for (const [index, queryVal] of maskedInput.entries()) {
          for (let entry of tableData) {

            if (entry === queryVal) {
              unionIndexes.push(index);
              break;
            }
          }
        }

        res.status(200).send(unionIndexes);
      });
    });

  })
});


module.exports = router;
