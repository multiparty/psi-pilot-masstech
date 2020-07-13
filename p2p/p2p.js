require('dotenv').config()

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const args = require('yargs').argv;
if (args.config) {
  process.env.NODE_ENV = args.config;
} else if (args.client) {
  process.env.NODE_ENV = 'client';
} else if (args.server) {
  process.env.NODE_ENV = 'server';
}

const config = require('config');
const fs = require('fs');
const dataGenerator = require('../utils/data-generator');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

const swaggerOptions = {
  swaggerDefinition: {
    components: {},
    info: {
      title: "Private Set Intersect API",
      description: "description",
    },
    servers: [
      {
        url: "http://localhost:3000"
      },
      {
        url: "http://localhost:8080"
      }
    ]
  },
  apis: ['p2p.js', './routes/*.js']
}

const app = express();
app.use(bodyParser.json({ limit: '50mb', extended: true }));

const specs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUI.serve, swaggerUI.setup(specs));

const listUpdateRoute = require('./routes/list-holder');
app.use('/listholder', listUpdateRoute.router);

const queryListRoute = require('./routes/query-list');
app.use('/querylist', queryListRoute.router);

if (args.client) {
  app.listen(config.port, () => {
    console.log("Running client mode on http://localhost:" + config.port);
  });

  let options = {
    'method': 'PUT',
    'url': config.protocol + '://localhost:' + config.port + '/querylist/setparams',
    data:
    {
      encodeType: config.encodeType,
      domain: 'localhost:' + config.port,
      holderDomain: config.serverDomain
    },
    responseType: 'json'
  };

  let queryData = [];

  if (config.queryData) {
    queryData = config.queryData;
  } else {
    queryData = dataGenerator.generateData(15, false);
  }

  const queryList = queryData.map(x => x.ssn);

  axios(options)
    .then(function (response) {

      options.method = 'GET';
      options.url = config.protocol + '://localhost:' + config.port + '/querylist/checkIfInList';
      options.data = { input: queryList, secret: process.env.SHARED, display: config.display };

      axios(options)
        .then(function (response) {

          if (response.data.length > 0) {
            console.log("\n\nIndividuals reported on list:\n++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
            response.data.map(index => {
              if (queryData[index].name) {
                console.log("Name: " + queryData[index].name);
              }
              if (queryData[index].address) {
                console.log("Address: " + queryData[index].address);
              }

              console.log("SSN: " + queryData[index].ssn);
              console.log("------------------------------------------------------------")
            });
          } else {
            console.log("\n\nNone of the specified individuals were reported on that list.");
          }
        })
        .catch(function (error) {
          console.log(error);
        });

    })
    .catch(function (error) {
      console.log(error);
    });

} else if (args.server) {
  if (fs.existsSync('./' + config.fileName)) {
    fs.unlinkSync('./' + config.fileName);
  }

  let dataSize = 1000;
  if (config.dataSize) {
    dataSize = config.dataSize;
  }

  app.listen(config.port, () => {
    console.log("Listening on http://localhost:" + config.port);
  });

  let data = [];
  if (config.tableData) {
    for (let i = 0; i < config.tableData.length; i++) {
      const randVal = Math.floor(Math.random() * (dataSize - data.length));
      data = data.concat(dataGenerator.generateSsnArray(randVal, true));
      data.push(config.tableData[i]);
    }
  } else {
    data = dataGenerator.generateSsnArray(dataSize, true);
  }

  let options = {
    method: 'POST',
    url: config.protocol + '://localhost:' + config.port + '/listholder/arrayUpdate',
    data: { input: data },
    responseType: 'json'
  };

  axios(options)
    .then(function (response) {

    })
    .catch(function (error) {
      console.log(error);
    });

} else {
  app.listen(config.port, () => {
    console.log("Listening on http://localhost:" + config.port);
  });
}
