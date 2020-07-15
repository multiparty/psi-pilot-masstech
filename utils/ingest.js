const csvParser = require('csv-parse/lib/sync');
const fs = require('fs');


/**
 * Reads in data from a csv file, outputting each row as an object
 * @param  {string} filePath - path to csv file that needs to be read
 * @returns {object[]} array of objects that contain data parsed from the csv file
 */
function readCsv(filePath, encoding='utf-8') {
  const file = fs.readFileSync(filePath, encoding);

  const data = csvParser(file, {
    columns: true,
    skip_empty_lines: true,
  });

  // make sure that keys of objects are all lowercase
  const result = data.map(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k.toLowerCase(), v])));

  return result;
}

exports.readCsv = readCsv;
