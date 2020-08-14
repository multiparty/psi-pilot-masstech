const express = require('express');
const router = express.Router();
const OPRF = require('oprf');

const dataGenerator = require('../../utils/data-generator');
const axios = require('axios');

const encodeType = 'ASCII';
const oprf = new OPRF();


/**
 * @param  {string[]} input
 * Can do multiple
 */
// TODO: Possibly split this into two functions so can be tested separately
// TODO: have unique server identifier for this party (probably solved with config)
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


  return { "shares": shares, "results": results };
}

// (async () => {
//   await oprf.ready;
//   const cpDomains = ["http://localhost:8000", "http://localhost:8001", "http://localhost:8002"];
//   const res = await computeAndSendShares(dataGenerator.generateSsnArray(2), cpDomains);
// })();

module.exports.computeAndSendShares = computeAndSendShares;
