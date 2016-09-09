'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.firstInstallInitiateConversation = firstInstallInitiateConversation;
exports.loginInitiateConversation = loginInitiateConversation;

var _controllers = require('../controllers');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// initiate conversation on first install
function firstInstallInitiateConversation(bot, team) {

	var config = {
		SlackUserId: team.createdBy
	};

	var botToken = bot.config.token;
	bot = _controllers.bots[botToken];

	bot.startPrivateConversation({ user: team.createdBy }, function (err, convo) {

		/**
   * 		INITIATE CONVERSATION WITH INSTALLER
   */

		convo.say('Hey! I\'m Toki!');
		convo.say('Thanks for inviting me to your team. I\'m excited to work together :grin:');

		convo.on('end', function (convo) {
			// let's save team info to DB
			console.log("\n\nteam info:\n\n");
			console.log(team);
		});
	});
}

// initiate conversation on login
function loginInitiateConversation(bot, identity) {

	var SlackUserId = identity.user.id;
	var botToken = bot.config.token;
	bot = _controllers.bots[botToken];

	_models2.default.User.find({
		where: { SlackUserId: SlackUserId }
	}).then(function (user) {
		var scopes = user.scopes;
		var accessToken = user.accessToken;


		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			/**
    * 		INITIATE CONVERSATION WITH LOGIN
    */
			convo.say('Awesome!');
			convo.say('Let\'s win this day. Let me know when you\'re ready to `/focus`');
		});
	});
}
//# sourceMappingURL=index.js.map