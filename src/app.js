// modules 
import express from 'express';
import bodyParser from 'body-parser';
var http = require('http').Server(app);
import dotenv from 'dotenv';

var app = express();
// http = http.Server(app);

// configuration 
dotenv.load();

// public folder for images, css,...
app.use(express.static(__dirname + '/public'))

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

// view engine ejs
app.set('view engine', 'ejs');

// routes
require('./app/routes/routes').default((app));

//port for Heroku
app.set('port', (process.env.PORT));

//botkit (apres port)
require('./app/controllers')

//START ===================================================
http.listen(app.get('port'), function(){
  console.log('listening on port ' + app.get('port'));
});
