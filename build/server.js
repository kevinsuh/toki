'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.bot = undefined;

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _cron = require('cron');

var _cron2 = _interopRequireDefault(_cron);

var _cron3 = require('./app/cron');

var _cron4 = _interopRequireDefault(_cron3);

var _controllers = require('./bot/controllers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CronJob
// modules

var CronJob = _cron2.default.CronJob;

// botkit


var app = (0, _express2.default)();

// configuration
_dotenv2.default.load();

// public folder for images, css,...
app.use('/assets', _express2.default.static(__dirname + '/public'));

//parsing
app.use(_bodyParser2.default.json()); // for parsing application/json
app.use(_bodyParser2.default.urlencoded({ extended: true })); //for parsing url encoded

// view engine ejs
app.set('view engine', 'ejs');

// routes
require('./app/router').default(app);

// Error Handling
app.use(function (err, req, res, next) {
	res.status(err.status || 500);
});

//port for Heroku
app.set('port', process.env.PORT);

/**
 * 			START THE SERVER + BOT
 */
// ===================================================

(0, _controllers.customConfigBot)(_controllers.controller);
var bot = _controllers.controller.spawn({
	token: process.env.BOT_TOKEN
});
exports.bot = bot;


app.listen(app.get('port'), function () {
	console.log('listening on port ' + app.get('port'));

	bot.startRTM(function (err) {
		if (!err) {
			console.log("RTM on and listening");

			/**
   * 						*** CRON JOB ***
   * @param  time increment in cron format
   * @param  function to run each increment
   * @param  function to run at end of cron job
   * @param  timezone of the job
   */
			new CronJob('*/5 * * * * *', _cron4.default, null, true, "America/New_York");
		} else {
			console.log("RTM failed");
		}
	});
});
//# sourceMappingURL=server.js.map