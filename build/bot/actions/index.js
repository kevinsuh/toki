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

var _constants = require('../lib/constants');

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

		convo.say('Hey <@' + team.createdBy + '>! I\'m Toki. Nice to meet you :wave:');
		convo.say({
			text: 'I help empower deep work for teams. Here\'s how I do it:',
			attachments: _constants.tokiExplainAttachments
		});
		convo.say('I\'m here whenever you\'re ready to go! Just let me know when you want to `/focus` on something. If you want to share me to others, you can `/explain @user`');
	});
}

// initiate conversation on login
function loginInitiateConversation(bot, identity) {

	var SlackUserId = identity.user_id;
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
			convo.say('Awesome! Let me know when you\'re ready to `/focus on [task] for [time]`');
		});
	});
}
//# sourceMappingURL=index.js.map