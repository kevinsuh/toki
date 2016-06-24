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

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _cron = require('cron');

var _cron2 = _interopRequireDefault(_cron);

var _cron3 = require('./app/cron');

var _cron4 = _interopRequireDefault(_cron3);

var _controllers = require('./bot/controllers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CronJob
// modules

var CronJob = _cron2.default.CronJob;

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

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	console.log("\n\n ~~ In development server of Navi ~~ \n\n");
	process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

/**
 * 			START THE SERVER + BOT
 */
// ===================================================

// botkit


(0, _controllers.customConfigBot)(_controllers.controller);
var bot = _controllers.controller.spawn({
	token: process.env.BOT_TOKEN
});
exports.bot = bot;


_controllers.controller.configureSlackApp({
	clientId: process.env.SLACK_ID,
	clientSecret: process.env.SLACK_SECRET,
	scopes: ['bot']
});
_controllers.controller.createWebhookEndpoints(app);
_controllers.controller.createOauthEndpoints(app, function (err, req, res) {
	if (err) {
		res.status(500).send('ERROR: ' + err);
	} else {
		res.send('Success!');
	}
});

// create HTTP service
_http2.default.createServer(app).listen(process.env.HTTP_PORT, function () {
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

			bot.startPrivateConversation({ user: "U121ZK15J" }, function (err, convo) {
				convo.say('Hey Kevin! I am live and ready for you :robot_face:');
			});
		} else {
			console.log("RTM failed");
		}
	});
});

// create HTTPS service identical to HTTP service on prod
if (env == 'production') {
	// options for HTTPS service
	var options = {
		key: _fs2.default.readFileSync('/etc/letsencrypt/live/tokibot.com/privkey.pem'),
		cert: _fs2.default.readFileSync('/etc/letsencrypt/live/tokibot.com/fullchain.pem')
	};
	_https2.default.createServer(options, app).listen(process.env.HTTPS_PORT);
}
//# sourceMappingURL=server.js.map