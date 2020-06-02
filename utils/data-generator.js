
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const Fakerator = require("fakerator");
const fakerator = Fakerator();

// Set parameters of CSV writer, should add new header for each data type
const csvWriter = createCsvWriter({
  path: 'generated-data.csv',
  header: [
    {id: 'ssn', title: 'SSN'},
    {id: 'name', title: 'Name'},
    {id: 'address', title: 'Address'},
  ]
});


/**
 * @param  {int} num - number of data entries needed
 * @param  {Boolean} writeToFile - whether to write to a csv file or not
 * @returns {object[]} array of data entries that were generated
 */
async function generateData(num, writeToFile) {
  let data = [];

  for(let i = 0; i < num; i++) {
    let ssn = generateSSN();
    let name = generateName();
    let address = generateAddress();
    data.push({ssn: ssn, name: name, address: address});
  }

  if(writeToFile){
    await csvWriter.writeRecords(data);
  }

  return data;
}

/**
 * @param  {int} num - number of data entries needed
 * @param  {Boolean} writeToFile - whether to write to a csv file or not
 * @returns {object[]} array of data entries that were generated
 */
async function generateSsnData(num, writeToFile) {
  let data = [];

  for(let i = 0; i < num; i++) {
    let ssn = generateSSN();
    data.push({ssn: ssn, name: name, address: address});
  }

  if(writeToFile){
    await csvWriter.writeRecords(data);
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

/**
 * * @returns {string} randomly generated name in format "lastName, firstName"
 */
function generateName(){
  let firstName = fakerator.names.firstName();//firstNames[Math.floor(Math.random()*firstNames.length)];
  let lastName = fakerator.names.lastName();//lastNames[Math.floor(Math.random()*lastNames.length)];

  let name = lastName + ", " + firstName;

  return name;
}

/**
 * @returns {string} randomly generated address in format "number street, city, state zipcode"
 */
function generateAddress(){
  let genAddress = fakerator.entity.address();

  let address = genAddress.street + ", " + genAddress.city + ", " + genAddress.state + " " + genAddress.zip;

  return address;
}

exports.generateData = generateData;
exports.generateSsnData = generateSsnData;
