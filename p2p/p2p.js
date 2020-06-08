require('dotenv').config()

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on http://localhost:" + port);
});


// const listQueryRoute = require('./routes/list-queries');
// app.use('/listqueries', listQueryRoute);

const listUpdateRoute = require('./routes/list-holder');
app.use('/listholder', listUpdateRoute);

const queryListRoute = require('./routes/query-list');
app.use('/querylist', queryListRoute);

/*var request = require("request");

var options = { method: 'GET',
  url: 'http://localhost:3000/querylist/maskWithHolderKey',
  headers:
   { 'cache-control': 'no-cache',
     Connection: 'keep-alive',
     Host: 'localhost:3000',
     'Postman-Token': '46b7e7e1-a310-4a8e-9f9c-84adcb772599,49759aa3-1c34-4198-970e-ec60f594fbf6',
     'Cache-Control': 'no-cache',
     Accept: '*//*',
     /*'User-Agent': 'PostmanRuntime/7.20.1',
     'Content-Type': 'application/json',
     Authorization: 'Bearer 6AQnIyMC6jUeNkE4eGvqW7BSOpdLrEvp4bIgmmsN_3Vgc8tABwNQ9QHmsMavZ5Z9ZWzgoLrx30tCEXxZyLFxtbUZlBmSFrYWxhOZspIXByZJoCC-geQi1fkAXCCuXXYx' },
  body:
   { input: [ '12345', '12345', '34523' ],
     key: '54',
     secret: '90842108' },
  json: true };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  const result = body.map(element => {
    return new Uint8Array(Object.values(element));
  })
  console.log(result);
});*/
