const express = require('express');
const router = express.Router();
const OPRF = require('oprf');
const fs = require('fs');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;

const encodeType = process.env.ENCODE_TYPE;
var fileName = 'table.csv'
const oprf = new OPRF();
const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
  ]
})

// send object { input: SSNum }
router.post('/singleUpdate', (req, res, next) => {
  const input = req.body.input;
  oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    const maskedData = oprf.scalarMult(oprf.hashToPoint(input), key);
    const encodedData = oprf.encodePoint(maskedData, encodeType);
    const dataToWrite = [{ 'ssn': encodedData }];

    let header = "";
    if (!fs.existsSync(fileName)) {
      header = csvStringifier.getHeaderString();
    }

    const body = csvStringifier.stringifyRecords(dataToWrite);
    fs.appendFileSync(fileName, header + body);
    res.status(200).send('Complete!');
  });
});

router.post('/objectUpdate', (req, res, next) => {
  const input = req.body.input;
  oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    const dataToWrite = input.map(entry => {
      const maskedEntry = oprf.scalarMult(oprf.hashToPoint(entry.ssn), key);
      const encodedEntry = oprf.encodePoint(maskedEntry, encodeType);
      return { 'ssn': encodedEntry };
    });

    let header = "";
    if (!fs.existsSync(fileName)) {
      header = csvStringifier.getHeaderString();
    }

    const body = csvStringifier.stringifyRecords(dataToWrite);
    fs.appendFileSync(fileName, header + body);
    res.status(200).send('Complete!');
  });
});

router.post('/arrayUpdate', (req, res, next) => {
  const input = req.body.input;
  oprf.ready.then(function () {
    const key = oprf.hashToPoint(process.env.KEY);

    const dataToWrite = input.map(entry => {
      const maskedEntry = oprf.scalarMult(oprf.hashToPoint(entry), key);
      const encodedEntry = oprf.encodePoint(maskedEntry, encodeType);
      return { 'ssn': encodedEntry }
    });

    let header = "";
    if (!fs.existsSync(fileName)) {
      header = csvStringifier.getHeaderString();
    }

    const body = csvStringifier.stringifyRecords(dataToWrite);
    fs.appendFileSync(fileName, header + body);
    res.status(200).send('Complete!');
  });
});

module.exports = router;
