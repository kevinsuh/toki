// modules 
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import dotenv from 'dotenv';
import { connectUsers } from './app/controllers';

var app = express();
// http = http.Server(app);

// configuration 
dotenv.load();

// public folder for images, css,...
app.use('/assets', express.static(`${__dirname}/public`));

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

// view engine ejs
app.set('view engine', 'ejs');

// routes
require('./app/router').default((app));

// Error Handling
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
});

//port for Heroku
app.set('port', (process.env.PORT));

//botkit (apres port)
require('./app/controllers')

//START ===================================================
app.listen(app.get('port'), () => {
  console.log('listening on port ' + app.get('port'));
});
