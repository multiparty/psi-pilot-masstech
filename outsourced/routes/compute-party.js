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
var defaultFileName = config.fileName;
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
let currentShares = [];
let cpShares = [];

function resetCPShares() {
  cpShares = cpDomains.map(domain => {
    return -1;
  });
}

resetCPShares();

// Just raises value to its key and sends it back
// Takes in encoded version of a point, decodes it, raises it, re-encodes it
// optional encodeType
// Input is a list of values to be raised to this CP's key
// Also requires the list creator's ID (for now just using domain);
// check if -1 not in the list, if not, then the key is not fresh
// this works because if you've gotten everyone's shares, no one should need your key anymore
router.get('/raiseToKey', (req, res, next) => {
  const input = req.body.input;
  const creatorDomain = req.body.creatorDomain;

  if (req.body.encodeType) encodeType = req.body.encodeType;

  function waitForFreshKey() {
    if (!cpShares.includes(-1)) {
      setTimeout(waitForFreshKey, 100);
    } else {
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
    }
  }

  waitForFreshKey();
});

// Method: Each party sends their share to each other party
// Receives a list of shares to
// Optional fileName that will be written to
// if no fileName sent, will not write
// Always just responds with the end result
// Needs to be told the other parties at some point
// TODO: cannot handle multiple requests, put mutex around whole thing, possibly just use the unique set ids rather than a mutex
// TODO: do I want requester to decide where it is stored?
// TODO: key used for this set is unique to this set. should I store things in different tables?
// Different creators' data will be stored in different tables and you have to decode, randomize, and recode everything when a new set from the same source comes in
// need to be sent the creator's identifier
// Always writes to a file
router.get('/computeFromShares', async (req, res, next) => {
  await oprf.ready;

  const creatorDomain = req.body.creatorDomain;
  if (args.test) {
    keys[creatorDomains.indexOf(creatorDomain)] = oprf.hashToPoint(config.testKeys.pop());
  } else {
    keys[creatorDomains.indexOf(creatorDomain)] = oprf.generateRandomScalar();
  }

  resetCPShares();
  // TODO: race with new keys newKey = true;
  // Solved by checking if -1 is in the list

  const input = req.body.input;
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

  let result = input;

  for (let [i, domain] of cpDomains.entries()) {
    let option = JSON.parse(defaultOptions);
    option.url = domain + '/computeparty/raiseToKey';
    option.data.input = result;
    option.data.creatorDomain = creatorDomain;
    await axios(option)
      .then(function (response) {
        result = response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  currentShares = result;
  isComputing = false;

  // Now collect shares from all of the other compute parties
  let options = [];

  // Instead of requesting from everyone else, just wait for them to send their finished shares to you

  // console.log("Calculated share: ");
  // console.log(oprf.decodePoint(currentShares[0], encodeType));


  cpDomains.forEach((CPDomain, i) => {
    const option = JSON.parse(defaultOptions);
    option.method = "PUT";
    option.url = CPDomain + "/computeparty/pushComputedShares";
    option.data = { input: currentShares, CPDomain: config.domain };
    option.domain = CPDomain;
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
            let share = randVal; //oprf.decodePoint(value, encodeType);
            cpShares.forEach((shares, cpIndex) => {
              // console.log("Adding: ");
              // console.log(share);
              // console.log("\nTo:");
              // console.log(shares[shareIndex]);
              share = oprf.sodium.crypto_core_ristretto255_add(share, shares[shareIndex]);//oprf.decodePoint(shares[shareIndex], encodeType));
            });
            share = oprf.sodium.crypto_core_ristretto255_sub(share, randVal);
            currentData.push(share);
          });

          currentData = currentData.map(value => {
            return oprf.encodePoint(value, encodeType);
          });

          const dataToWrite = currentData.map(entry => {
            return { 'ssn': entry };
          });

          let header = "";
          if (!fs.existsSync(creatorDomain + '.csv')) {
            header = csvStringifier.getHeaderString();
          }

          const body = csvStringifier.stringifyRecords(dataToWrite);
          // console.log("\n\n\nBody:");
          // console.log(body);
          fs.appendFileSync(process.env.NODE_ENV + 'table' + creatorDomains.indexOf(creatorDomain) + '.csv', header + body);


          // console.log("\n\n\nReturn");
          // console.log(currentData);

          res.status(200).json(currentData);
        }
      }

      waitForAllShares();
    }))
    .catch(function (error) {
      console.log(error);
    });
});

// May want to use a semaphore or something for while it is computing its shares?
// Probably better to switch to a semaphore rather than a flag to handle multiple incoming requests
router.get('/getComputedShares', (req, res, next) => {
  function waitForCompute() {
    if (isComputing) {
      // console.log("Checking isComputing");
      setTimeout(waitForCompute, 100);
    } else {
      res.status(200).json(currentShares);
    }
  }

  waitForCompute();
});

// Need a CP ID (use cp domain for now)
router.put('/pushComputedShares', (req, res, next) => {
  const CPDomain = req.body.CPDomain;

  cpShares[cpDomains.indexOf(CPDomain)] = req.body.input;

  res.status(200).send("Share pushed!");
});

// Will need to have a specific file for each
/*
router.get('/listData', (req, res, next) => {

  const tableData = ingest.readCsv(req.body.fileName);
  const result = tableData.map(entry => {
    return entry.ssn;
  });

  res.status(200).json(result);
}); */

module.exports = {
  router: router
}
