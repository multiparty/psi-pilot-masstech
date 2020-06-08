require('dotenv').config()

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Listening on http://localhost:" + port);
});

//const listQueryRoute = require('./routes/list-queries');
//app.use('/listqueries', listQueryRoute);

const listUpdateRoute = require('./routes/list-updates');
app.use('/listupdates', listUpdateRoute);

// const queryListRoute = require('./routes/query-list');
// app.use('/querylist', queryListRoute);
