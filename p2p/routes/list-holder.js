const express = require('express');
const router = express.Router();
const OPRF = require('oprf');
const fs = require('fs');
const ingest = require('../../utils/ingest');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;

const encodeType = 'ASCII';
var fileName = 'table.csv'
const oprf = new OPRF();
const csvStringifier = createCsvStringifier({
  header: [
    { id: 'ssn', title: 'SSN' },
  ]
})

router.put('/listname/:fileName', (req, res, next) => {
  fileName = req.params.fileName + '.csv';
  if(req.body.encodeType) encodeType = req.body.encodeType;

  res.status(200).send("File changed to " + fileName + " successfully");
});

// send object { input: SSNum }
router.post('/singleUpdate', (req, res, next) => {
  const input = req.body.input;
  if(req.body.encodeType) encodeType = req.body.encodeType;

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
  if(req.body.encodeType) encodeType = req.body.encodeType;

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
  if(req.body.encodeType) encodeType = req.body.encodeType;

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

router.get('/raiseToKey', (req, res, next) => {
  if(req.body.secret != process.env.SHARED){
    res.status(403).send("Error 403: Incorrect shared secret value");
  } else {
    const input = req.body.input;
    oprf.ready.then(function () {
      const key = oprf.hashToPoint(process.env.KEY);

      const data = input.map(entry => {
        const maskedValue = oprf.scalarMult(oprf.decodePoint(entry, encodeType), key);
        return oprf.encodePoint(maskedValue, encodeType);
      });

      res.status(200).json(data);
    });
  }
});

router.get('/listdata', (req, res, next) => {
  if(req.body.secret != process.env.SHARED) {
    res.status(403).send("Error 403: Incorrect shared secret value");
  } else {
    const tableData = ingest.readCsv(fileName);

    const result = tableData.map(entry => {
      return entry.ssn;
    });

    res.status(200).json(result);
  }
});

router.put('/listname/:fileName', (req, res, next) => {
  fileName = req.params.fileName + '.csv';
  res.status(200).send("File changed to " + fileName + " successfully");
});

module.exports = router;
