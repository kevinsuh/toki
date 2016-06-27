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

var _controllers = require('./bot/controllers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// CronJob

var CronJob = _cron2.default.CronJob; // modules


setTimeout(function () {
	console.log("\n\n\n ~~ updating and seeding users ~~ \n\n\n");
	// updateUsers(); // to fill in all users who are not in DB yet
	// seedUsers();
}, 5000);

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
		teamTokens.forEach(function (token) {
			var bot = _controllers.controller.spawn({ token: token }).startRTM(function (err) {
				if (err) {
					console.log('Error connecting to slack... :', err);
				} else {
					if (token == process.env.BOT_TOKEN) {
						bot.startPrivateConversation({ user: "U121ZK15J" }, function (err, convo) {
							convo.say("Good morning Kevin, I'm ready for you :robot_face:");
						});
					}
					(0, _controllers.trackBot)(bot); // this is where we store all ze bots
				}
			});
		});
	});
});
//# sourceMappingURL=server.js.map