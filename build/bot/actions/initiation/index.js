'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.firstInstallInitiateConversation = firstInstallInitiateConversation;
exports.loginInitiateConversation = loginInitiateConversation;

var _controllers = require('../../controllers');

var _botResponses = require('../../lib/botResponses');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// initiate conversation on first install
function firstInstallInitiateConversation(bot, team) {

	bot.startPrivateConversation({ user: team.createdBy }, function (err, convo) {

		/**
   * 		INITIATE CONVERSATION WITH INSTALLER
   */

		convo.say('Hey! I\'m Toki!');
		convo.say('This is your first time installing me');

		convo.on('end', function (convo) {
			// let's save team info to DB
			console.log("\n\nteam info:\n\n");
			console.log(team);
		});
	});
}

// initiate conversation on login
function loginInitiateConversation(bot, team) {
	console.log("in login initiate convo");
	console.log(team);

	bot.startPrivateConversation({ user: team.createdBy }, function (err, convo) {

		convo.say('Hey! I\'m Toki!');
		convo.say('I\'m logged in and ready to go');
	});
}
//# sourceMappingURL=index.js.map