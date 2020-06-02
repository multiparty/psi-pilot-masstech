const csvParser = require('csv-parse/lib/sync');
const fs = require('fs');


/**
 * @param  {string} filePath - path to csv file that needs to be read
 * @returns {object[]} array of objects that contain data parsed from the csv file
 */
function readCsv(filePath){
  const file = fs.readFileSync(filePath);

  const data = csvParser(file, {
    columns: true,
    skip_empty_lines: true,
  });

  // make sure that keys of objects are all lowercase
  let result = [];
  data.forEach(obj => {
    let keys = Object.keys(obj);
    let newobj = {};
    for(let i = 0; i < keys.length; i++) {
      newobj[keys[i].toLowerCase()] = obj[keys[i]];
    }
    result.push(newobj);
  });


  return result;
}

exports.readCsv = readCsv;
