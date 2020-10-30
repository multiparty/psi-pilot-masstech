require('dotenv').config();
const express = require('express');
const router = express.Router();
const OPRF = require('oprf');
const config = require('config');
const fs = require('fs');
const ingest = require('../../utils/ingest');
const axios = require('axios');
const args = require('yargs').argv;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;

let encodeType = config.encodeType;
const cpDomains = config.computePartyDomains;
const dataDomains = config.dataDomains;
// One key is needed for every list creator
let keys = [];
const oprf = new OPRF();
oprf.ready.then(() => {
  if (args.test) {
    keys = dataDomains.map(dataDomain => {
      return oprf.hashToPoint(config.testKeys.pop());
    });
  } else {
    keys = dataDomains.map(dataDomain => {
      return oprf.generateRandomScalar();
    });
  }
});

const csvStringifier = createCsvStringifier({
  header: [
    {id: 'ssn', title: 'SSN'},
  ]
});
const plainShareStringifier = createCsvStringifier({
  header: [
    {id: 'share', title: 'SHARE'},
  ]
});
let cpShares = [];

function resetCPShares() {
  cpShares = cpDomains.map(domain => {
    return -1;
  });
}

resetCPShares();

/**
 * @swagger
 * tags:
 *   name: Compute Party
 *   description: Performing MPC and answering list queries
 */

/**
 * @swagger
 * path:
 *  /computeparty/raiseToKey:
 *    get:
 *      summary: Raises list of values to the compute party's current key and returns them
 *      tags: [Compute Party]
 *      parameters:
 *       - in: body
 *         name: To-Be-Raised
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - dataDomain
 *            - isUpdate
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Encoded points to be raised to compute party's key
 *             dataDomain:
 *               type: string
 *               description: Domain of the creator whose list these values will be appended to/queried against
 *             isUpdate:
 *               type: Boolean
 *               description: Whether this is a list update or a query
 *      responses:
 *        "400":
 *          description: Invalid creator domain.  That creator does not have a list with this compute party
 *        "200":
 *          description: Values were raised to compute party's key
 *          schema:
 *            type: array
 *            items:
 *              type: string
 *              description: values raised to both the compute party's key
 *            example:
 *              [ " rã\u0004\\ÉtÝè³\u000e¯nEu0018Å÷¹\tóv2£z\u0006«Ë?ì}", "¤vcÑ\u0017\u0014'ièèã1Q)Ë-jú{ÍµW§)Öà*\u0010", "ú9e\u001dJ=ÀÓJË3\u0005õ\n_Aí(Íib4\u000eÈNãx3", ... ]
 */
router.get('/raiseToKey', (req, res, next) => {
  const input = req.body.input;
  const dataDomain = req.body.dataDomain;
  const isUpdate = req.body.isUpdate;

  if (req.body.encodeType) encodeType = req.body.encodeType;

  function waitForFreshKey() {
    // A -1 being in the list implies that someone else needs your key, if there are no -1's no one needs your current key and therefore it is old
    if (!isUpdate || cpShares.includes(-1)) {
      const keyIndex = dataDomains.indexOf(dataDomain);

      // Key was not found for specified dataDomain
      if (keyIndex === -1) {
        console.log('Key not found error!');
        res.status(400).send('Invalid data domain sent in request. No key listed for data domain ' + dataDomain + '.');
      }

      oprf.ready.then(function () {
        const key = keys[keyIndex];
        const result = input.map(entry => {
          const decodedInput = oprf.decodePoint(entry, encodeType);
          return oprf.encodePoint(oprf.scalarMult(decodedInput, key), encodeType)
        });

        res.status(200).json(result);
      });
    } else {
      setTimeout(waitForFreshKey, 100);
    }
  }

  waitForFreshKey();
});

/**
 * @swagger
 * path:
 *  /computeparty/computeFromShares:
 *    get:
 *      summary: Calculates the original value of the shares received raised to each compute party's key, writes to a file if it is a list update
 *      tags: [Compute Party]
 *      parameters:
 *       - in: body
 *         name: Share-Info
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - dataDomain
 *            - isUpdate
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Shares of hashed oprf points generated from list creator's data
 *             dataDomain:
 *               type: string
 *               description: Domain of the creator whose list these values are being appended to/queried against
 *             isUpdate:
 *               type: Boolean
 *               description: Whether this is a list update or a query
 *      responses:
 *        "200":
 *          description: Shares were calculated correctly
 *          schema:
 *            type: array
 *            items:
 *              type: string
 *              description: Sum of all of the shares sent to comopute parties raised to every compute party's key
 */
router.get('/computeFromShares', async (req, res, next) => {
  await oprf.ready;

  const isUpdate = req.body.isUpdate;
  const dataDomain = req.body.dataDomain;
  let input = req.body.input;

  if (isUpdate) {
    if (args.test) {
      keys[dataDomains.indexOf(dataDomain)] = oprf.hashToPoint(config.testKeys.pop());
    } else {
      keys[dataDomains.indexOf(dataDomain)] = oprf.generateRandomScalar();
    }
  }

  await resetCPShares();

  if (isUpdate) {
    // Store the new shares sent to you so that you have them for the next request
    const dataToWrite = input.map(entry => {
      return {'share': entry};
    });

    const shareFileName = process.env.NODE_ENV + 'shares' + dataDomains.indexOf(dataDomain) + '.csv';
    let header = '';
    if (!fs.existsSync(shareFileName)) {
      header = plainShareStringifier.getHeaderString();
    }

    const body = plainShareStringifier.stringifyRecords(dataToWrite);
    fs.appendFileSync(shareFileName, header + body);

    // TODO: Change order after reading all of the shares back
    const allShares = ingest.readCsv(shareFileName);
    input = allShares.map(entry => {
      return entry.share;
    });
  }

  if (req.body.encodeType) {
    encodeType = req.body.encodeType;
  }

  var defaultOptions = {
    'method': 'GET',
    'url': config.domain,
    data:
      {
        input: input[0]
      },
    responseType: 'json'
  };

  defaultOptions = JSON.stringify(defaultOptions);

  let currentShares = input;

  // Call raiseToKey of each other CP on the entire list of shares that you were sent
  for (let [i, domain] of cpDomains.entries()) {
    let option = JSON.parse(defaultOptions);
    option.url = domain + '/computeparty/raiseToKey';
    option.data.input = currentShares;
    option.data.isUpdate = isUpdate;
    option.data.dataDomain = dataDomain;
    await axios(option)
      .then(function (response) {
        currentShares = response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  // Now push your shares to all other compute parties, and wait for them to do the same to you
  let options = [];


  cpDomains.forEach((cpDomain, i) => {
    const option = JSON.parse(defaultOptions);
    option.method = 'PUT';
    option.url = cpDomain + '/computeparty/pushComputedShares';
    option.data = {input: currentShares, cpDomain: config.domain};
    option.domain = cpDomain;
    options.push(option);
  });

  const requests = options.map(option => {
    return axios(option);
  });

  axios.all(requests)
    .then(axios.spread((...responses) => {

      function waitForAllShares() {
        // if it includes -1, you have not received one of the shares
        if (cpShares.includes(-1)) {
          setTimeout(waitForAllShares, 100);
        } else {

          // Now we just need to sum similar shares of all CPs i.e., all of the first shares together, all of the second shares together, and so on
          let currentData = [];

          cpShares = cpShares.map(shares => {
            shares = shares.map(share => {
              return oprf.decodePoint(share, encodeType);
            });
            return shares;
          });

          // cpShares is array of array of shares, indexed by compute party
          // Sum shares pairwise
          const sum = (r, a) => r.map((b, i) => oprf.sodium.crypto_core_ristretto255_add(a[i], b));
          currentData = cpShares.reduce(sum);

          currentData = currentData.map(value => {
            return oprf.encodePoint(value, encodeType);
          });

          if (isUpdate) {
            // Write the masked and summed data to a table file that can be gotten upon request by querier
            const dataToWrite = currentData.map(entry => {
              return {'ssn': entry};
            });

            const tableFilename = process.env.NODE_ENV + 'table' + dataDomains.indexOf(dataDomain) + '.csv';
            let header = '';
            if (!fs.existsSync(tableFilename)) {
              header = csvStringifier.getHeaderString();
            }

            const body = csvStringifier.stringifyRecords(dataToWrite);
            fs.appendFileSync(tableFilename, header + body);
          }

          res.status(200).json(currentData);
        }
      }

      waitForAllShares();
    }))
    .catch(function (error) {
      console.log(error);
    });
});

/**
 * @swagger
 * path:
 *  /computeparty/pushComputedShares:
 *    put:
 *      summary: Places computed shares to this compute party so that they can be added together
 *      tags: [Compute Party]
 *      parameters:
 *       - in: body
 *         name: Push-Data
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - cpDomain
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Shares calculated by another compute party being sent to this compute party
 *             cpDomain:
 *               type: string
 *               description: Domain of the cp sending these shares
 *      responses:
 *        "200":
 *          description: Shares were pushed to this compute party successfully
 */
router.put('/pushComputedShares', (req, res, next) => {
  const cpDomain = req.body.cpDomain;

  cpShares[cpDomains.indexOf(cpDomain)] = req.body.input;

  res.status(200).send('Share pushed!');
});

/**
 * @swagger
 * path:
 *  /computeparty/listData:
 *    get:
 *      summary: Returns the data stored in a list for the given creator
 *      tags: [Compute Party]
 *      parameters:
 *       - in: body
 *         name: List-Query
 *         schema:
 *           type: object
 *           required:
 *            - dataDomain
 *           properties:
 *             dataDomain:
 *               type: string
 *               description: Domain of the creator whose list is being queried
 *           example:
 *             dataDomain: "http://localhost:3000"
 *      responses:
 *        "200":
 *          description: Table data returned
 *          schema:
 *            type: array
 *            items:
 *              type: string
 *              description: Array of the entries on the creator's list
 */
router.get('/listData', (req, res, next) => {
  const dataDomain = req.body.dataDomain;
  const tableFilename = process.env.NODE_ENV + 'table' + dataDomains.indexOf(dataDomain) + '.csv';

  const tableData = ingest.readCsv(tableFilename);
  const result = tableData.map(entry => {
    return entry.ssn;
  });

  res.status(200).json(result);
});

module.exports = {
  router: router
}
