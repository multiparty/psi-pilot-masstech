const express = require('express');
const router = express.Router();
const OPRF = require('oprf');
const fs = require('fs');
const ingest = require('../../utils/ingest');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const config = require('config');

let encodeType = config.encodeType;
let fileName = config.fileName;
const oprf = new OPRF();
const csvStringifier = createCsvStringifier({
  header: [
    {id: 'ssn', title: 'SSN'},
  ]
});

/**
 * @swagger
 * tags:
 *   name: Update List
 *   description: Updating and editing private list
 */

/**
 * Changes the active list being edited to newName
 * @param  {String} newName - Name of file to begin writing to/reading from
 */
function changeListname(newName) {
  fileName = newName;
  return fileName;
}

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
  if (req.body.encodeType) {
    encodeType = req.body.encodeType;
  }

  oprf.ready.then(function () {
    const key = oprf.decodePoint(process.env.KEY, encodeType);

    const dataToWrite = input.map(entry => {
      const maskedEntry = oprf.scalarMult(oprf.hashToPoint(entry), key);
      const encodedEntry = oprf.encodePoint(maskedEntry, encodeType);
      return {'ssn': encodedEntry}
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
 *          description: Values were raised to holder's key
 *          schema:
 *            type: array
 *            items:
 *              type: string
 *              description: values raised to both the querier's and holder's key
 *            example:
 *              [ " rã\u0004\\ÉtÝè³\u000e¯nEu0018Å÷¹\tóv2£z\u0006«Ë?ì}", "¤vcÑ\u0017\u0014'ièèã1Q)Ë-jú{ÍµW§)Öà*\u0010", "ú9e\u001dJ=ÀÓJË3\u0005õ\n_Aí(Íib4\u000eÈNãx3", ... ]
 */
router.get('/raiseToKey', (req, res, next) => {
  if (req.body.secret != process.env.SHARED) {
    res.status(403).send("Error 403: Incorrect shared secret value");
  } else {
    const input = req.body.input;
    oprf.ready.then(function () {
      const key = oprf.decodePoint(process.env.KEY, encodeType);

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
 *          description: List entries successfully read from active list
 *          schema:
 *            type: array
 *            items:
 *              type: string
 *              description: Entries stored in the list
 *            example: [ "E.ëXX¼p\u000f}49û¦ÐxÓ>'Ú\u000b\n}¢©\u0004&\b8", " rã\u0004\\ÉtÝè³\u000e¯nEu0018Å÷¹\tóv2£z\u0006«Ë?ì}", "xVÝ\u0013:-ÓÜ\u0002©µD\u001d\u0007,¡óÑ`L\u0007H\u0014z=¤\u0014êV", "äg\u000fÓ½^^[\u0015bXOAÝ(rÌ\t¬£ÙÙ5ùÿ\u0012", "¦³\u0012BÏ5¿¿é!ÀB#\rB\u0016#ñµOðü\u0013e6E8\rH", ",°!\u000fËó\u000bbûqà©\u0000ZÊ»ÆÂ2,Û6XÞ\u0007W", ... ]
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

module.exports = {
  router: router,
  changeListname: changeListname
}
