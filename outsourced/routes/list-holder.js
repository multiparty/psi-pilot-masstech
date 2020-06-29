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
async function computeAndSendShares(input, parties) {

  await oprf.ready;

  let result = [];
  for (let i = 0; i < input.length; i++) {
    const hashedInput = oprf.hashToPoint(input[i]);

    let elementShares = [];
    for (let j = 0; j < parties.length - 1; j++) {
      elementShares.push(oprf.generateRandomScalar());
    }

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
  for (let cpIndex = 0; cpIndex < parties.length; cpIndex++) {
    let cpShare = [];
    for (let dataIndex = 0; dataIndex < result.length; dataIndex++) {
      cpShare.push(oprf.encodePoint(result[dataIndex][cpIndex], encodeType));
    }
    shares.push(cpShare);
  }


  let options = [];

  // TODO: Send to compute parties
  // Possibly send some unique key for these requests to ensure that they're the same request
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
    },
    responseType: 'json'
  };

  // Need to stringify in order to clone the object
  defaultOptions = JSON.stringify(defaultOptions);

  parties.forEach((domain, i) => {
    const option = JSON.parse(defaultOptions);
    option.url = "http://" + domain + "/computeparty/computeFromShares";
    option.domain = domain;
    option.data.input = shares[i];
    options.push(option);
  });

  const requests = options.map(option => {
    return axios(option);
  });

  axios.all(requests)
    .then(axios.spread((...responses) => {
      responses.forEach(element => {
        console.log(element.data);
      });
      // responses.forEach((element, i) => {
      // element.data.forEach((value, j) => {
      //   console.log("\n\n\nAnswer " + i + ", " + j);
      //   const share1 = oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.decodePoint(shares[i][j], encodeType), oprf.hashToPoint("94302825")), oprf.hashToPoint("78456342")), oprf.hashToPoint("43542187"));
      //   const share2 =
      //   // console.log(oprf.encodePoint(oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.decodePoint(shares[i][j], encodeType), oprf.hashToPoint("94302825")), oprf.hashToPoint("78456342")), oprf.hashToPoint("43542187")), encodeType))
      //   console.log("\n\nResponse " + i + ", " + j);
      //   console.log(value);

      // });
      // });

      // const share1 = oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.decodePoint(shares[0][0], encodeType), oprf.hashToPoint("94302825")), oprf.hashToPoint("78456342")), oprf.hashToPoint("43542187"));
      // const share2 = oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.decodePoint(shares[1][0], encodeType), oprf.hashToPoint("94302825")), oprf.hashToPoint("78456342")), oprf.hashToPoint("43542187"));
      // const share3 = oprf.scalarMult(oprf.scalarMult(oprf.scalarMult(oprf.decodePoint(shares[2][0], encodeType), oprf.hashToPoint("94302825")), oprf.hashToPoint("78456342")), oprf.hashToPoint("43542187"));
      // const finalVal = oprf.sodium.crypto_core_ristretto255_add(oprf.sodium.crypto_core_ristretto255_add(share1, share2), share3);
      // console.log("\n\n\nAnswer for value " + 0);
      // console.log(finalVal);
      // console.log("\n\nResponses for value " + 0);
      // console.log(oprf.decodePoint(responses[0].data[0], encodeType));
      // console.log(oprf.decodePoint(responses[1].data[0], encodeType));
      // console.log(oprf.decodePoint(responses[2].data[0], encodeType));
    }))
    .catch(function (error) {
      console.log(error);
    });

  return shares;
}

(async () => {
  const cpDomains = ["localhost:8000", "localhost:8001", "localhost:8002"];
  const res = await computeAndSendShares(["123456789", "9809430543", "9403523453"], cpDomains);
})();

module.exports = router;
