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
});

/**
 * @swagger
 * tags:
 *   name: Update List
 *   description: Updating and editing private list
 */

/**
 * @swagger
 * path:
 *  /listholder/listname:
 *    put:
 *      summary: Change the active list file
 *      tags: [Update List]
 *      parameters:
 *       - in: body
 *         name: FileName-Update
 *         schema:
 *           type: object
 *           required:
 *            - fileName
 *           properties:
 *             fileName:
 *               type: string
 *               description: Name of the file to change to the active file without extension
 *             encodeType:
 *               type: string
 *               description: Whether to encode data being stored in 'ASCII' or 'UTF-8'
 *           example:
 *             input: "test-table"
 *             encodeType: "ASCII"
 *      responses:
 *        "200":
 *          description: Active file was successfully changed
 *          content:
 *            text/plain:
 *              schema:
 *                type: string
 *                example: "File changed to test-table successfully"
 */
router.put('/listname/', (req, res, next) => {
  fileName = req.body.fileName + '.csv';
  if (req.body.encodeType) encodeType = req.body.encodeType;

  res.status(200).send("File changed to " + fileName + " successfully");
});

/**
 * @swagger
 * path:
 *  /listholder/singleUpdate:
 *    post:
 *      summary: Add a single entry to the private list
 *      tags: [Update List]
 *      parameters:
 *       - in: body
 *         name: Single-Update
 *         schema:
 *           type: object
 *           required:
 *            - input
 *           properties:
 *             input:
 *               type: string
 *               description: Value to be masked and appended to list
 *             encodeType:
 *               type: string
 *               description: Whether to encode data being stored in 'ASCII' or 'UTF-8'
 *           example:
 *             input: "123456789"
 *             encodeType: "ASCII"
 *      responses:
 *        "200":
 *          description: Input was successfully appended to the list
 */
router.post('/singleUpdate', (req, res, next) => {
  const input = req.body.input;
  if (req.body.encodeType) encodeType = req.body.encodeType;

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
    res.status(200).send('Single entry successfully added!');
  });
});

/**
 * @swagger
 * path:
 *  /listholder/objectUpdate:
 *    post:
 *      summary: Add many SSNs passed in objects to the list
 *      tags: [Update List]
 *      parameters:
 *       - in: body
 *         name: Object-Update
 *         schema:
 *           type: object
 *           required:
 *            - input
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: object
 *                 required:
 *                   - ssn
 *                 properties:
 *                   ssn:
 *                     type: string
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *             encodeType:
 *               type: string
 *               description: Whether to encode data being stored in 'ASCII' or 'UTF-8'
 *           example:
 *             input: [ { ssn: "123456789", name: "Billy Williamson", address: "123 Second St" }, { ssn: "123456790", name: "James Jameson", address: "124 Second St" } ]
 *             encodeType: "ASCII"
 *      responses:
 *        "200":
 *          description: Entries were successfully appended to the list
 */
router.post('/objectUpdate', (req, res, next) => {
  const input = req.body.input;
  if (req.body.encodeType) encodeType = req.body.encodeType;

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

/**
 * @swagger
 * path:
 *  /listholder/arrayUpdate:
 *    post:
 *      summary: Add many SSNs passed in an array to the list
 *      tags: [Update List]
 *      parameters:
 *       - in: body
 *         name: Array-Update
 *         schema:
 *           type: object
 *           required:
 *            - input
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: SSN to be appended to active list
 *             encodeType:
 *               type: string
 *               description: Whether to encode data being stored in 'ASCII' or 'UTF-8'
 *           example:
 *             input: [ "123456789", "987654321", "443256598" ]
 *             encodeType: "ASCII"
 *      responses:
 *        "200":
 *          description: Entries were successfully appended to the list
 */
router.post('/arrayUpdate', (req, res, next) => {
  const input = req.body.input;
  if (req.body.encodeType) encodeType = req.body.encodeType;

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

/**
 * @swagger
 * tags:
 *   name: List Data
 *   description: Handling requests to the list holder
 */

/**
 * @swagger
 * path:
 *  /listholder/raiseToKey:
 *    get:
 *      summary: Raises all values passed to list holder's key and returns them
 *      tags: [List Data]
 *      parameters:
 *       - in: body
 *         name: Raise-Data
 *         schema:
 *           type: object
 *           required:
 *            - input
 *            - secret
 *           properties:
 *             input:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Values that have been raised to querier's key to be raised to holder's key
 *             secret:
 *               type: string
 *               description: Shared secret between list holder and querier
 *           example:
 *             input: [ '*Û\nå¨T¾ô;g\r×ÛDð!½\u0017Xú³\u0005${Ì\f', '\u001cW·2ªíáY¶,3hMë¢Þ×', '¬Æ¾sÉxÖªCÈYù\u0018(\r\u001c\u0017Ý\u00194\f ¡ØÉÉA\u0007\u000b', '\u0007þ\u0005 .è¬îù¡ÕMæà&¤Î©k\f\u0013xo ', 'læÿ\u00122\u0003U!ÝøJ5¯ånÔ\u0019¶üT6±Xy¿-\t' ]
 *             secret: "9201839012"
 *      responses:
 *        "403":
 *          description: Incorrect shared key passed in
 *        "200":
 *          description: Entries were successfully appended to the list
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  input:
 *                    type: array
 *                    items:
 *                      type: string
 *                      description: values raised to both the querier's and holder's key
 */
router.get('/raiseToKey', (req, res, next) => {
  if (req.body.secret != process.env.SHARED) {
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

/**
 * @swagger
 * path:
 *  /listholder/listdata:
 *    get:
 *      summary: Sends back all of the entries contained in the active list
 *      tags: [List Data]
 *      parameters:
 *       - in: body
 *         name: Data-Request
 *         schema:
 *           type: object
 *           required:
 *            - secret
 *           properties:
 *             secret:
 *               type: string
 *               description: Shared secret between list holder and querier
 *           example:
 *             secret: "9201839012"
 *      responses:
 *        "403":
 *          description: Incorrect shared key passed in
 *        "200":
 *          description: Entries were successfully appended to the list
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  input:
 *                    type: array
 *                    items:
 *                      type: string
 *                      description: Entries stored in the list
 *
 */
router.get('/listdata', (req, res, next) => {
  if (req.body.secret != process.env.SHARED) {
    res.status(403).send("Error 403: Incorrect shared secret value");
  } else {
    const tableData = ingest.readCsv(fileName);

    const result = tableData.map(entry => {
      return entry.ssn;
    });

    res.status(200).json(result);
  }
});

module.exports = router;
