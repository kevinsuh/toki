import request from 'request';
import express from 'express';
import pg from 'pg';

var router = express.Router();

import { dbConnectionString } from '../../models/database';

/**
 *    TASKS CONTROLLER
 *    `/api/v1/tasks`
 */

// index
router.get('/', (req, res) => {
});

// create
router.post('/', (req, res) => {

  var results = [];

  // grab data from API request
  // done is defaulted to false w/ new tasks
  var data = { text: req.body.text, done: false };

  console.log(`in post: ${dbConnectionString}`);
  // var client = new pg.Client(connectionString);
  // client.connect();

  // get a PG client from connection pool
  pg.connect(dbConnectionString, (err, client, done) => {

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
    query.on('row', (row) => {
      console.log(`returning row: ${JSON.stringify(row)}`);
      results.push(row);
    });

    // after all data is returned, close and return results
    query.on('end', () => {
      done();
      return res.json(results);
    })

  });

});

// read
router.get('/:id', (req, res) => {
});

// update
router.put('/:id', (req, res) => {
});

// delete
router.delete('/:id', (req, res) => {
});;


export default router;