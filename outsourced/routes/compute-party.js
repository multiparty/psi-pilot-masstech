const express = require('express');
const router = express.Router();
const OPRF = require('oprf');
const config = require('config');
const fs = require('fs');
const ingest = require('../../utils/ingest');
const axios = require('axios');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;

const encodeType = 'ASCII';
const cpDomains = config.computePartyDomains;
const key = config.key;
let isComputing = false;
var defaultFileName = 'table';
const oprf = new OPRF();
const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
  ]
});
let currentShares = [];
let currentData = [];

router.get('/', (req, res, next) => {
  res.status(200).send("Hellow World");
});

// Just raises value to its key and sends it back
// Takes in encoded version of a point, decodes it, raises it, re-encodes it
// optional encodeType
// TODO: Make this take in lists instead of individual requests
router.get('/raiseToKey', (req, res, next) => {
  const input = req.body.input;
  if (req.body.encodeType) encodeType = req.body.encodeType;
  oprf.ready.then(function () {
    const decodedInput = oprf.decodePoint(input, encodeType);
    result = oprf.scalarMult(decodedInput, oprf.hashToPoint(key));
    result = oprf.encodePoint(result, encodeType);

    res.status(200).json(result);
  });
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
router.get('/computeFromShares', async (req, res, next) => {
  isComputing = true;
  const input = req.body.input;
  const fileName = req.body.fileName;
  if (req.body.encodeType) encodeType = req.body.encodeType;

  await oprf.ready;

  var defaultOptions = {
    'method': 'GET',
    'url': 'http://localhost:3000',
    'headers': {
      'cache-control': 'no-cache',
      Connection: 'keep-alive',
      Host: 'localhost:3000',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    },
    data:
    {
      input: input[0]
    },
    responseType: 'json'
  };

  defaultOptions = JSON.stringify(defaultOptions);

  // console.log("\n\n\n\nNEW REQUEST:\n-------------------")


  let result = input;

  for (let [shareIndex, share] of input.entries()) {
    for (let [i, domain] of cpDomains.entries()) {
      // console.log("Go " + i);
      let option = JSON.parse(defaultOptions);
      option.url = 'http://' + domain + '/computeparty/raiseToKey';
      option.data.input = result[shareIndex];
      option.headers.Host = domain;
      await axios(option)
        .then(function (response) {
          result[shareIndex] = response.data;
        })
        .catch(function (error) {
          console.log(error);
        });
    };
  };

  currentShares = result;
  isComputing = false;

  // Now collect shares from all of the other compute parties
  let options = [];

  cpDomains.forEach((domain, i) => {
    if (domain != config.domain) {
      const option = JSON.parse(defaultOptions);
      option.url = "http://" + domain + "/computeparty/getComputedShares";
      option.domain = domain;
      options.push(option);
    }
  });

  const requests = options.map(option => {
    return axios(option);
  });

  currentData = currentShares.map(share => {
    return oprf.decodePoint(share, encodeType);
  });
  axios.all(requests)
    .then(axios.spread((...responses) => {
      // Response is a list of the responses that went out
      responses.forEach((response, cpIndex) => {
        // response.data is a list of the masked shares that each party had
        // they now need to be summed to get the final product
        response.data.forEach((value, shareIndex) => {
          // console.log("\n\n\n\n\nAdding");
          // console.log(currentData[shareIndex]);
          // console.log("\n\n\nto");
          // console.log(oprf.decodePoint(value, encodeType));
          currentData[shareIndex] = oprf.sodium.crypto_core_ristretto255_add(currentData[shareIndex], oprf.decodePoint(value, encodeType));
        });
      });

      currentData = currentData.map(value => {
        return oprf.encodePoint(value, encodeType);
      });

      if (fileName) {
        const dataToWrite = currentData.map(entry => {
          return { 'ssn' : entry };
        });

        let header = "";
        if (!fs.existsSync(fileName + '.csv')) {
          header = csvStringifier.getHeaderString();
        }

        const body = csvStringifier.stringifyRecords(dataToWrite);
        console.log("\n\n\nBody:");
        console.log(body);
        fs.appendFileSync(fileName + '.csv', header + body);
      }

      console.log("\n\n\nReturn");
      console.log(currentData);

      // Properly sends back the data, summed together and masked by all keys
      res.status(200).json(currentData);
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

// should get a shared secret, showing they're an approved querier
// TODO: Decide whether to have an active file or not
router.get('/listData', (req, res, next) => {
  // Check if secret is the same
  const tableData = ingest.readCsv(req.body.fileName);
  const result = tableData.map(entry => {
    return entry.ssn;
  });

  res.status(200).json(result);
});

module.exports = router;
