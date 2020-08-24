require('dotenv').config()

const args = require('yargs').argv;
if (args.config) {
  process.env.NODE_ENV = args.config;
}

const axios = require('axios');
const config = require('config');
const fs = require('fs');
const dataGenerator = require('../utils/data-generator');

/**
 * Makes a query request to see if any individuals in queryData are in the table and displays their information
 * @param  {Object[]} queryData - Information about individuals being searched against the table
 */
function searchForEntries(queryData) {
  const queryList = queryData.map(x => x.ssn);

  let options = {
    'method': 'GET',
    'url': config.domain + '/querylist/checkIfInList',
    data:
      { input: queryList, secret: process.env.SHARED },
    responseType: 'json'
  };

  axios(options)
    .then(function (response) {
      console.log("\n\n------------------------------------------------------------");
      if (response.data.length > 0) {
        console.log("\nIndividuals reported on list:\n++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
        response.data.map(index => {
          if (queryData[index].name) {
            console.log("Name: " + queryData[index].name);
          }
          if (queryData[index].address) {
            console.log("Address: " + queryData[index].address);
          }

          console.log("SSN: " + queryData[index].ssn);
          console.log("------------------------------------------------------------");
        });
      } else {
        console.log("\n\nNone of the specified individuals were reported on that list.");
        console.log("------------------------------------------------------------");
      }
    })
    .catch(function (error) {
      console.log(error);
    });
}

/**
 * Makes a list holder request to create a new table with both randomly generated, and selected data
 * @param  {int} dataSize - Size of the table to be created
 */
function createNewList(dataSize) {

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
    url: config.domain + '/listholder/arrayUpdate',
    data: { input: data },
    responseType: 'json'
  };

  axios(options)
    .then(function (response) {
      console.log("List successfully created!");
    })
    .catch(function (error) {
      console.log(error);
    });
}



if (args.querier) {
  let queryData = [];

  if (config.queryData) {
    queryData = config.queryData;
  } else {
    queryData = dataGenerator.generateData(15, false);
  }

  searchForEntries(queryData);
} else if (args.holder) {
  // Make sure you are using a new file
  if (fs.existsSync('./' + config.fileName)) {
    fs.unlinkSync('./' + config.fileName);
  }

  let dataSize = 1000;
  if (config.dataSize) {
    dataSize = config.dataSize;
  }

  createNewList(dataSize);
}
