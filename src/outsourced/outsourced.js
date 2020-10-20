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

const queryListRoute = require('./routes/query-list');
app.use('/querylist', queryListRoute.router);

const computePartyRoute = require('./routes/compute-party');
app.use('/computeparty', computePartyRoute.router);

const listCreatorRoute = require('./routes/list-creator');
app.use('/listcreator', listCreatorRoute.router);

app.listen(config.domain.split(':')[2], () => {
  console.log("Listening on http://localhost:" + config.domain.split(':')[2]);
  console.log(process.env.NODE_ENV);
});
