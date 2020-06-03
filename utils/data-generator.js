
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const fs = require('fs');

const Fakerator = require("fakerator");
const fakerator = Fakerator();

// Set parameters of CSV writer, should add new header for each data type
const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
    { id: 'name', title: 'Name' },
    { id: 'address', title: 'Address' },
  ]
});


/**
 * Generates a list of random data entries which can be output to a csv file
 * @param  {int} num - number of data entries needed
 * @param  {Boolean} writeToFile - whether to write to a csv file or not
 * @returns {object[]} array of data entries that were generated
 */
function generateData(num, writeToFile) {
  let data = [];

  for (let i = 0; i < num; i++) {
    const ssn = generateSSN();
    const name = generateName();
    const address = generateAddress();
    data.push({ ssn: ssn, name: name, address: address });
  }

  if (writeToFile) {
    const header = csvStringifier.getHeaderString();
    const body = csvStringifier.stringifyRecords(data);
    fs.writeFileSync('generated-data.csv', header + body);
  }

  return data;
}

/**
 * Generates a list of random SSNs which can be output to a csv file
 * @param  {int} num - number of data entries needed
 * @param  {Boolean} writeToFile - whether to write to a csv file or not
 * @returns {object[]} array of data entries that were generated
 */
async function generateSsnData(num, writeToFile) {
  let data = [];

  for (let i = 0; i < num; i++) {
    const ssn = generateSSN();
    data.push({ ssn: ssn });
  }

  if (writeToFile) {
    const header = csvStringifier.getHeaderString();
    const body = csvStringifier.stringifyRecords(data);
    fs.writeFileSync('generated-data.csv', header + body);
  }

  return data;
}

/**
 * Generates a random SSN
 * @returns {string} randomly generated, 9-digit social security number
 */
function generateSSN() {
  let newSSN = '';
  const numbers = '0123456789';

  for (let i = 0; i < 9; i++) {
    newSSN += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return newSSN
}

/**
 * Generates a random name
 * * @returns {string} randomly generated name in format "lastName, firstName"
 */
function generateName() {
  const firstName = fakerator.names.firstName();
  const lastName = fakerator.names.lastName();

  const name = lastName + ", " + firstName;

  return name;
}

/**
 * Generates a random address
 * @returns {string} randomly generated address in format "number street, city, state zipcode"
 */
function generateAddress() {
  const genAddress = fakerator.entity.address();

  const address = genAddress.street + ", " + genAddress.city + ", " + genAddress.state + " " + genAddress.zip;

  return address;
}

exports.generateData = generateData;
exports.generateSsnData = generateSsnData;

console.log(generateData(3,true));
