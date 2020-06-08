require('dotenv').config()

const express = require('express');
const router = express.Router();
const OPRF = require('oprf');
const ingest = require('../../utils/ingest');

const encodeType = process.env.ENCODE_TYPE;
var fileName = 'table.csv'
const oprf = new OPRF();


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
