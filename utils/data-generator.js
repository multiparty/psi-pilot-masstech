
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Set parameters of CSV writer, should add new header for each data type
const csvWriter = createCsvWriter({
  path: 'generated-data.csv',
  header: [
    {id: 'ssn', title: 'SSN'},
  ]
});


/**
 * @param  {int} num - number of data entries needed
 * @param  {Boolean} writeToFile - whether to write to a csv file or not
 * @returns {object[]} array of data entries that were generated
 */
function generateData(num, writeToFile) {
  let data = [];

  for(let i = 0; i < num; i++) {
    let newSSN = generateSSN();
    data.push({ssn: newSSN});
  }

  if(writeToFile){
    csvWriter.writeRecords(data)
  }

  return data;
}

/**
 * @returns {string} randomly generated, 9-digit social security number
 */
function generateSSN(){
  let newSSN = '';
  let numbers = '0123456789';

  for(let i = 0; i < 9; i++){
    newSSN += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return newSSN
}
