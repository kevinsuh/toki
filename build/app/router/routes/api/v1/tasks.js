'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

var _database = require('../../../../models/database');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

/**
 *    TASKS CONTROLLER
 *    `/api/v1/tasks`
 */

// index
router.get('/', function (req, res) {});

// create
router.post('/', function (req, res) {

  var results = [];

  // grab data from API request
  // done is defaulted to false w/ new tasks
  var data = { text: req.body.text, done: false };

  console.log('in post: ' + _database.dbConnectionString);
  // var client = new pg.Client(connectionString);
  // client.connect();

  // get a PG client from connection pool
  _pg2.default.connect(_database.dbConnectionString, function (err, client, done) {

    // handle connection errors
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({ success: false, data: err });
    }

    // SQL insert
    client.query("INSERT INTO tasks(text, done) values($1, $2)", [data.text, data.complete]);

    // return back tasks
    var query = client.query("SELECT * FROM tasks ORDER by id ASC");

    // stream results back in node fashion
    query.on('row', function (row) {
      console.log('returning row: ' + JSON.stringify(row));
      results.push(row);
    });

    // after all data is returned, close and return results
    query.on('end', function () {
      done();
      return res.json(results);
    });
  });
});

// read
router.get('/:id', function (req, res) {});

// update
router.put('/:id', function (req, res) {});

// delete
router.delete('/:id', function (req, res) {});;

exports.default = router;
//# sourceMappingURL=tasks.js.map