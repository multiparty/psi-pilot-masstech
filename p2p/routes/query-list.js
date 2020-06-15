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

/**
 * @swagger
 * tags:
 *   name: Query List
 *   description: Extracting information from another list holder
 */

/**
 * @swagger
 * path:
 *  /querylist/setparams:
 *    put:
 *      summary: Changes the encode type, domain, and list holder domain being used
 *      parameters:
 *       - in: body
 *         name: Query-Array
 *         schema:
 *           type: object
 *           properties:
 *             encodeType:
 *               type: string
 *               description: Whether to encode oprf values in 'ASCII' or 'UTF-8'
 *             domain:
 *               type: string
 *               description: The querier's domain
 *             holderDomain:
 *               type: string
 *               description: The domain of the list holder to be queried
 *           example:
 *             encodeType: "ASCII"
 *             domain: "localhost:3000"
 *             holderDomain: "localhost:8080"
 *      responses:
 *        "200":
 *          description: Parameters were successfully updated
 *          schema:
 *            type: string
 *            example: "Encoding set to ASCII domain set to localhost:3000, and holder domain set to localhost:8080"
 */
router.put('/setParams', (req, res, next) => {
  if (req.body.encodeType) {
    encodeType = req.body.encodeType;
  }
  if (req.body.domain) {
    domain = req.body.domain;
  }
  if (req.body.holderDomain) {
    holderDomain = req.body.holderDomain;
  }

  res.status(200).send("Encoding set to " + encodeType + ", domain set to " + domain + ", and holder domain set to " + holderDomain);
});

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
 *             display:
 *               type: boolean
 *               description: Whether or not to display the values sent to the list holder
 *           example:
 *             input: [ "748320512", "002381635", "129427809", ... ]
 *             key: "56423091200"
 *             secret: "23449023"
 *      responses:
 *        "200":
 *          description: Values were masked by list holder
 *          schema:
 *           type: array
 *           items:
 *             type: string
 *             description: values raised to both the querier's and holder's key
 *           example:
 *             [ " rã\u0004\\ÉtÝè³\u000e¯nEu0018Å÷¹\tóv2£z\u0006«Ë?ì}", "¤vcÑ\u0017\u0014'ièèã1Q)Ë-jú{ÍµW§)Öà*\u0010", "ú9e\u001dJ=ÀÓJË3\u0005õ\n_Aí(Íib4\u000eÈNãx3", ... ]
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

    if (req.body.display) {
      console.log("Values being sent to list holder: ");
      console.log(options.body.input);
    }

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
        secret: secret,
        display: req.body.display
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
