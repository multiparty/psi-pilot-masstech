require('dotenv').config();

const express = require('express');
const router = express.Router();
const axios = require('axios');
const OPRF = require('oprf');

let encodeType = 'ASCII';
const oprf = new OPRF();
const cpDomains = [
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:8002"
]
const creatorDomains = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002"
]

async function getTableData(creatorDomain) {
  var options = {
    method: 'GET',
    url: cpDomains[0] + '/computeparty/listData',
    data:
    {
      creatorDomain: creatorDomain
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

async function computeAndSendShares(input, cpDomains, creatorDomain) {

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
    'url': creatorDomain,
    data:
    {
    },
    responseType: 'json'
  };

  // Need to stringify in order to clone the object
  defaultOptions = JSON.stringify(defaultOptions);

  cpDomains.forEach((domain, i) => {
    const option = JSON.parse(defaultOptions);
    option.url = domain + "/computeparty/computeFromShares";
    option.domain = domain;
    option.data.input = shares[i];
    option.data.creatorDomain = creatorDomain;
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

  return { "shares": shares, "results": results };
}

async function checkIfInList(input, cpDomains, creatorDomain) {

  const maskedInput = (await computeAndSendShares(input, cpDomains, creatorDomain)).results[0];

  const tableData = await getTableData(creatorDomain);

  let unionIndexes = [];

  for (const [index, queryVal] of maskedInput.entries()) {
    for (let entry of tableData) {

      if (entry === queryVal) {
        unionIndexes.push(index);
        break;
      }
    }
  }

  return unionIndexes;
}

const dataGenerator = require('../../utils/data-generator');

// (async () => {
//   await oprf.ready;
//   const res = await checkIfInList(dataGenerator.generateSsnArray(10), cpDomains, creatorDomains[0]);
// })();

module.exports.getTableData = getTableData;
module.exports.computeAndSendShares = computeAndSendShares;
module.exports.checkIfInList = checkIfInList;
