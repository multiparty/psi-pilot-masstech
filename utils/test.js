const dataGenerator = require('./data-generator');
const ingest = require('./ingest');
const assert = require('assert');

const DATA_SIZE = 1000;

async function test(){

     var data = await dataGenerator.generateData(DATA_SIZE,true);

     assert(data.length === DATA_SIZE, "Test  had the wrong number of entries.");

     var ingestData = ingest.readCsv('generated-data.csv');

     for(let i = 0; i < data.length; i++){
       let dataProperties = Object.getOwnPropertyNames(data[i]);
       let ingestDataProperties = Object.getOwnPropertyNames(ingestData[i]);

       assert(dataProperties.length == ingestDataProperties.length, "Objects from written and read data have a different number of properties.");

       for(let j = 0; j < dataProperties.length; j++){
         assert(data[i][dataProperties[j]] == ingestData[i][ingestDataProperties[j]], dataProperties[j] + " is unequal between written and read objects objects. " + data[i][dataProperties[j]] + " != " + ingestData[i][ingestDataProperties[j]]);
       }

     }

  console.log("data-generator and ingest read and write correctly!");
}

test();


