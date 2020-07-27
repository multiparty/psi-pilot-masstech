require('dotenv').config()

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const args = require('yargs').argv;
if (args.config) {
  process.env.NODE_ENV = args.config;
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

app.listen(config.port, () => {
  console.log("Listening on http://localhost:" + config.port);
});
