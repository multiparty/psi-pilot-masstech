require('dotenv').config();

const express = require('express');
const router = express.Router();
const request = require('request');
const OPRF = require('oprf');

const encodeType = process.env.ENCODE_TYPE;
const oprf = new OPRF();

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
      url: 'http://' + process.env.OTHER_DOMAIN + '/listholder/raiseToKey',
      headers:
      {
        'cache-control': 'no-cache',
        Connection: 'keep-alive',
        //'Content-Length': '99',
        Host: process.env.OTHER_DOMAIN,
        'Postman-Token': 'fc1f1da5-31d4-46b3-a004-a4652933ff5d,d058b93b-e7a8-43c0-b1fd-690ba3b4fd73',
        'Cache-Control': 'no-cache',
        Accept: '*/*',
        'User-Agent': 'PostmanRuntime/7.20.1',
        'Content-Type': 'application/json',
        Authorization: 'Bearer 6AQnIyMC6jUeNkE4eGvqW7BSOpdLrEvp4bIgmmsN_3Vgc8tABwNQ9QHmsMavZ5Z9ZWzgoLrx30tCEXxZyLFxtbUZlBmSFrYWxhOZspIXByZJoCC-geQi1fkAXCCuXXYx'
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
      url: 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata',
      headers:
      {
        'cache-control': 'no-cache',
        Connection: 'keep-alive',
        Host: process.env.OTHER_DOMAIN,
        'Postman-Token': '46b7e7e1-a310-4a8e-9f9c-84adcb772599,a317a329-fbcd-46d7-9765-a704171899a1',
        'Cache-Control': 'no-cache',
        Accept: '*/*',
        'User-Agent': 'PostmanRuntime/7.20.1',
        'Content-Type': 'application/json',
        Authorization: 'Bearer 6AQnIyMC6jUeNkE4eGvqW7BSOpdLrEvp4bIgmmsN_3Vgc8tABwNQ9QHmsMavZ5Z9ZWzgoLrx30tCEXxZyLFxtbUZlBmSFrYWxhOZspIXByZJoCC-geQi1fkAXCCuXXYx'
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

router.get('/checkIfInList', (req, res, next) => {
  const input = req.body.input;
  const secret = req.body.secret;

  oprf.ready.then(function () {

    const key = oprf.generateRandomScalar();

    var options = {
      method: 'GET',
      url: 'http://' + process.env.OTHER_DOMAIN + '/querylist/maskWithHolderKey',
      headers:
      {
        'cache-control': 'no-cache',
        Connection: 'keep-alive',
        Host: process.env.OTHER_DOMAIN,
        'Postman-Token': '46b7e7e1-a310-4a8e-9f9c-84adcb772599,49759aa3-1c34-4198-970e-ec60f594fbf6',
        'Cache-Control': 'no-cache',
        Accept: '*/*',
        'User-Agent': 'PostmanRuntime/7.20.1',
        'Content-Type': 'application/json',
        Authorization: 'Bearer 6AQnIyMC6jUeNkE4eGvqW7BSOpdLrEvp4bIgmmsN_3Vgc8tABwNQ9QHmsMavZ5Z9ZWzgoLrx30tCEXxZyLFxtbUZlBmSFrYWxhOZspIXByZJoCC-geQi1fkAXCCuXXYx'
      },
      body:
      {
        input: input,
        key: oprf.encodePoint(key,encodeType),
        secret: secret
      },
      json: true
    };

    request(options, function (error, response, maskedInput) {
      if (error) throw new Error(error);

      options.url = 'http://' + process.env.OTHER_DOMAIN + '/listholder/listdata';
      options.body = { 'secret': secret };

      request(options, function (error, response, tableData) {
        if (error) throw new Error(error);

        let unionIndexes = [];
        for (const [index, queryVal] of maskedInput.entries()) {
          for (let entry of tableData) {

            if(entry === queryVal){
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
