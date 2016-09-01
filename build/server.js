'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _cron = require('cron');

var _cron2 = _interopRequireDefault(_cron);

var _cron3 = require('./app/cron');

var _cron4 = _interopRequireDefault(_cron3);

var _scripts = require('./app/scripts');

require('./app/globalHelpers');

var _controllers = require('./bot/controllers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// modules 
var CronJob = _cron2.default.CronJob;

// CronJob


var app = (0, _express2.default)();

// configuration 
_dotenv2.default.load();

// public folder for images, css,...
app.use('/assets', _express2.default.static(__dirname + '/public'));

//parsing
app.use(_bodyParser2.default.json()); // for parsing application/json
app.use(_bodyParser2.default.urlencoded({ extended: true })); //for parsing url encoded

// include bootstrap and jQuery
app.use('/js', _express2.default.static(__dirname + '/../node_modules/bootstrap/dist/js'));
app.use('/js', _express2.default.static(__dirname + '/../node_modules/jquery/dist'));
app.use('/css', _express2.default.static(__dirname + '/../node_modules/bootstrap/dist/css'));
app.use('/fonts', _express2.default.static(__dirname + '/../node_modules/bootstrap/dist/fonts'));

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
	console.log("\n\n ~~ In development server of Toki ~~ \n\n");
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

_controllers.controller.configureSlackApp({
	clientId: process.env.SLACK_ID,
	clientSecret: process.env.SLACK_SECRET,
	scopes: ['bot', 'commands']
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
	console.log('\n\n ~~Listening on port: ' + app.get('port') + '~~ \n\n');

	/**
 * 						*** CRON JOB ***
 * @param  time increment in cron format
 * @param  function to run each increment
 * @param  function to run at end of cron job
 * @param  timezone of the job
 */
	new CronJob('*/5 * * * * *', _cron4.default, null, true, "America/New_York");

	// add bot to each team
	var teamTokens = [];
	_controllers.controller.storage.teams.all(function (err, teams) {
		if (err) {
			throw new Error(err);
		}

		// connect all the teams with bots up to slack
		for (var t in teams) {
			if (teams[t]) {
				teamTokens.push(teams[t].token);
			}
		}

		/**
   * 		~~ START UP ZE BOTS ~~
   */
		teamTokens.forEach(function (token, index) {
			var bot = _controllers.controller.spawn({ token: token, retry: 500 }).startRTM(function (err, bot, payload) {

				if (payload) {
					var teamMembers = payload.users; // array of user objects!
					(0, _scripts.seedAndUpdateUsers)(teamMembers);
				}

				if (err) {
					console.log('\n\n\'Error connecting to slack... :\' ' + err);
				} else {
					if (token == process.env.BOT_TOKEN && process.env.KEVIN_SLACK_USER_ID) {
						bot.startPrivateConversation({ user: process.env.KEVIN_SLACK_USER_ID }, function (err, convo) {
							convo.say("Good morning Kevin, I'm ready for you :robot_face:");
						});
						if (env == "production" && process.env.CHIP_SLACK_USER_ID) {
							bot.startPrivateConversation({ user: process.env.CHIP_SLACK_USER_ID }, function (err, convo) {
								convo.say("Hello Chip, I'm ready for you :robot_face:");
							});
						}
					}
					(0, _controllers.trackBot)(bot); // this is where we store all ze bots
				}
			});
		});
	});
});
//# sourceMappingURL=server.js.map