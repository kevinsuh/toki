/**
 * 		experimenting around with pg
 */

import pg from 'pg';
var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432';
var dbName = 'navi';

// var client = new pg.Client(connectionString);
// client.connect();

pg.connect(connectionString, function(err, client, done) { // connect to postgres db
    if (err)
        console.log('Error while connecting: ' + err); 
    client.query('CREATE DATABASE ' + dbName, function(err) { // create user's db
        if (err) 
            console.log('ignoring the error'); // ignore if the db is there
        client.end(); // close the connection

        // create a new connection to the new db
        pg.connect(`${connectionString}/${dbName}`, function(err, clientOrg, done) {
            // create the table
            var tableName = 'tasks';
            var query = clientOrg.query(`CREATE TABLE IF NOT EXISTS ${tableName}(id SERIAL PRIMARY KEY, text VARCHAR(40), done BOOLEAN)`); 
            query.on('end', function() { client.end(); });
        });
    });
});



