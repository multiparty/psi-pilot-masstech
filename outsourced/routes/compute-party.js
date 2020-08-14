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

const encodeType = config.encodeType;
const cpDomains = config.computePartyDomains;
const creatorDomains = config.creatorDomains;
// One key is needed for every list creator
let keys = [];
const oprf = new OPRF();
oprf.ready.then(() => {
  if (args.test) {
    keys = creatorDomains.map(creatorDomain => {
      return oprf.hashToPoint(config.testKeys.pop());
    });
  } else {
    keys = creatorDomains.map(creatorDomain => {
      return oprf.generateRandomScalar();
    });
  }
});

const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
  ]
});
const plainShareStringifier = createCsvStringifier({
  header: [
    { id: 'share', title: 'SHARE' },
  ]
});
let cpShares = [];

function resetCPShares() {
  cpShares = cpDomains.map(domain => {
    return -1;
  });
}

resetCPShares();

// Takes in encoded version of a point, decodes it, raises it, re-encodes it
// optional encodeType
// Input is a list of values to be raised to this CP's key
// Also requires the list creator's ID (for now just using domain);
// check if -1 not in the list, if not, then the key is not fresh
// A -1 being in the list implies that someone else needs your key, if there are no -1's no one needs your current key and therefore it is old
router.get('/raiseToKey', (req, res, next) => {
  const input = req.body.input;
  const creatorDomain = req.body.creatorDomain;
  const isUpdate = req.body.isUpdate;

  if (req.body.encodeType) encodeType = req.body.encodeType;

  function waitForFreshKey() {
    if (!isUpdate || cpShares.includes(-1)) {
      const keyIndex = creatorDomains.indexOf(creatorDomain);

      // Key was not found for specified creatorDomain
      if (keyIndex == -1) {
        console.log("Key not found error!");
        res.status(400).send("Invalid creator domain sent in request.  No key listed for creator domain " + creatorDomain + ".");
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

// Receives a list of shares to be masked and summed
// Returns the final calculation
// Needs to be told the other parties at some point (config file)
// need to be sent the creator's identifier
// Uses isUpdate to determine whether this is a interseciton check or a list update
router.get('/computeFromShares', async (req, res, next) => {
  await oprf.ready;

  const isUpdate = req.body.isUpdate;
  const creatorDomain = req.body.creatorDomain;
  let input = req.body.input;

  if (isUpdate) {
    if (args.test) {
      keys[creatorDomains.indexOf(creatorDomain)] = oprf.hashToPoint(config.testKeys.pop());
    } else {
      keys[creatorDomains.indexOf(creatorDomain)] = oprf.generateRandomScalar();
    }
  }

  await resetCPShares();

  if (isUpdate) {
    // Store the new shares sent to you so that you have them for the next request
    const dataToWrite = input.map(entry => {
      return { 'share': entry };
    });

    const shareFileName = process.env.NODE_ENV + 'shares' + creatorDomains.indexOf(creatorDomain) + '.csv';
    let header = "";
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

  if (req.body.encodeType) encodeType = req.body.encodeType;

  var defaultOptions = {
    'method': 'GET',
    'url': 'http://localhost:3000',
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
    option.data.creatorDomain = creatorDomain;
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
    option.method = "PUT";
    option.url = cpDomain + "/computeparty/pushComputedShares";
    option.data = { input: currentShares, cpDomain: config.domain };
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

          cpShares[0].forEach((value, shareIndex) => {
            let randVal = oprf.generateRandomScalar();
            let share = randVal;

            // TODO use new oprf functions for addition and subtraction
            cpShares.forEach((shares, cpIndex) => {
              share = oprf.sodium.crypto_core_ristretto255_add(share, shares[shareIndex]);
            });
            share = oprf.sodium.crypto_core_ristretto255_sub(share, randVal);
            currentData.push(share);
          });

          currentData = currentData.map(value => {
            return oprf.encodePoint(value, encodeType);
          });

          if (isUpdate) {
            // Write the masked and summed data to a table file that can be gotten upon request by querier
            const dataToWrite = currentData.map(entry => {
              return { 'ssn': entry };
            });

            const tableFilename = process.env.NODE_ENV + 'table' + creatorDomains.indexOf(creatorDomain) + '.csv';
            let header = "";
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

// Need a CP ID (use cp domain for now)
router.put('/pushComputedShares', (req, res, next) => {
  const cpDomain = req.body.cpDomain;

  cpShares[cpDomains.indexOf(cpDomain)] = req.body.input;

  res.status(200).send("Share pushed!");
});

// Need a list creator id (use domain for now)
router.get('/listData', (req, res, next) => {
  const creatorDomain = req.body.creatorDomain;
  const tableFilename = process.env.NODE_ENV + 'table' + creatorDomains.indexOf(creatorDomain) + '.csv';

  const tableData = ingest.readCsv(tableFilename);
  const result = tableData.map(entry => {
    return entry.ssn;
  });

  res.status(200).json(result);
});

module.exports = {
  router: router
}
