
const fs = require('fs');
const OPRF = require('oprf');
const ingest = require('./utils/ingest');
const args = require('yargs').argv;

const oprf = new OPRF();
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
  ]
});

const fileName = "utftable.csv";
if(fs.existsSync(fileName)) {
  fs.unlinkSync(fileName);
}


async function testSingle() {
  await oprf.ready;

  let ogScalar = oprf.generateRandomScalar();
  console.log("Original Scalar: ");
  console.log(ogScalar);

  let encodedScalar = oprf.encodePoint(ogScalar);
  console.log("\n\n------------------------");
  console.log("Encoded OG Scalar:");
  console.log(encodedScalar);
  console.log("------------------------");

  let dataToWrite = [];
  dataToWrite.push({ 'ssn': encodedScalar });

  let header = "";
  if (!fs.existsSync(fileName)) {
    header = csvStringifier.getHeaderString();
  }

  const body = csvStringifier.stringifyRecords(dataToWrite);
  fs.appendFileSync(fileName, header + body, 'ucs2');
  const tableData = ingest.readCsv(fileName, 'ucs2');
  const tableVals = tableData.map(entry => {
    return entry.ssn;
  });

  const firstVal = tableVals[0];

  console.log("\n\n------------------------")
  console.log("Read Back:");
  console.log(firstVal);
  console.log("------------------------");

  console.log("\n\n------------------------");
  console.log("Decoded To:");
  console.log(oprf.decodePoint(firstVal));
  console.log("------------------------");

  console.log("\n\n------------------------");
  console.log("OG vs Read:");
  console.log(ogScalar);
  console.log(oprf.decodePoint(firstVal));
  console.log("------------------------");
}

async function testMany() {
  const testSize = 100;
  await oprf.ready;

  let ogScalars = [];
  for(i = 0; i < testSize; i++) {
    ogScalars.push(oprf.generateRandomScalar());
  }

  const encodedScalars = ogScalars.map(scalar => {
    return { 'ssn': oprf.encodePoint(scalar, 'ucs-2') };
  });

  let header = "";
  if (!fs.existsSync(fileName)) {
    header = csvStringifier.getHeaderString();
  }

  const body = csvStringifier.stringifyRecords(encodedScalars);
  fs.appendFileSync(fileName, header + body, 'ucs-2');

  const tableData = ingest.readCsv(fileName, 'ucs-2');
  const tableVals = tableData.map(entry => {
    return entry.ssn;
  });

  const decodedEntries = tableVals.map(entry => {
    return oprf.decodePoint(entry);
  });

  let errors = 0;

  tableVals.forEach((tableVal, index) => {
    if(tableVal != encodedScalars[index].ssn) {
      console.log("\n\n-------------------------");
      console.log("Mismatch!");
      console.log("Original Encoding: " + encodedScalars[index].ssn);
      console.log("Read Encoding: " + tableVal);
      console.log("Decodings:");
      console.log("Original Scalar: ");
      console.log(ogScalars[index]);
      console.log("Read Scalar:");
      console.log(decodedEntries[index]);
      console.log("-------------------------");
      errors++;
    }
  });

  console.log("Total Errors: " + errors);
}

async function testEncoding() {
  const testSize = 10;
  await oprf.ready;

  let ogScalars = [];
  for(i = 0; i < testSize; i++) {
    ogScalars.push(oprf.generateRandomScalar());
  }

  const encodedScalars = ogScalars.map(scalar => {
    return oprf.encodePoint(scalar);
  });

  const decodedScalars = encodedScalars.map(scalar => {
    return oprf.decodePoint(scalar);
  });

  let errors = 0;

  decodedScalars.forEach((scalar, i) => {
    const ogScalar = ogScalars[i];
    // console.log("Checking: " + encodedScalars[i]);
    let equal = true;

    scalar.forEach((value, index) => {
      equal = equal && (value == ogScalar[index]);
    });

    if(!equal) {
      console.log("\n\n-------------------------");
      console.log("Mismatch!  Encoding:");
      console.log(encodedScalars[i]);
      console.log("Decodings:");
      console.log(ogScalar);
      console.log(scalar);
      console.log("-------------------------");
      errors++;
    }
  });

  console.log("Total Errors: " + errors);
}

if(args.encode) {
  testEncoding();
} else if(args.single) {
  testSingle();
} else {
  testMany();
}

