require('dotenv').config();

const express = require('express');
const router = express.Router();
const axios = require('axios');
const OPRF = require('oprf');

let encodeType = 'ASCII';
const oprf = new OPRF();

async function getListData(listHolderDomain, secret) {
  var options = {
    method: 'GET',
    url: 'http://' + listHolderDomain + '/computeparty/listData',
    headers:
    {
      'cache-control': 'no-cache',
      Connection: 'keep-alive',
      Host: listHolderDomain,
      'Cache-Control': 'no-cache',
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    data:
    {
      secret: secret,
      fileName: "table0.csv"
    },
    responseType: 'json'
  };

  axios(options)
  .then(function (response) {
    console.log(response.data);

    return response.data;
  })
  .catch(function (error) {
    console.log(error);
  });
}

(async () => {
  await oprf.ready;
  const listHolderDomain = "localhost:8000";
  const res = await getListData(listHolderDomain, "12345");
})();
