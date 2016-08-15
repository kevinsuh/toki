'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// we'll stick our notifications flow here for now
	controller.on('notify_team_member', function (bot, config) {
		var IncluderSlackUserId = config.IncluderSlackUserId;
		var IncludedSlackUserId = config.IncludedSlackUserId;

		// IncluderSlackUserId is the one who's actually using Toki

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', IncluderSlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var nickName = user.nickName;
			var SlackName = user.SlackUser.SlackName;

			var name = SlackName ? '@' + SlackName : nickName;

			user.getDailyTasks({
				where: ['"DailyTask"."type" = ?', "live"],
				include: [_models2.default.Task],
				order: '"Task"."done", "DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {

				dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");

				var options = { dontShowMinutes: true, dontCalculateMinutes: true };
				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

				if (IncludedSlackUserId) {
					bot.startPrivateConversation({ user: IncludedSlackUserId }, function (err, convo) {

						convo.notifyTeamMember = {
							dailyTasks: dailyTasks
						};

						convo.say('Hey! ' + name + ' wanted me to share their top priorities with you today:\n' + taskListMessage);
						convo.say('If you have any questions about what ' + name + ' is working on, please send them a Slack message :mailbox:');
					});
				}
			});
		});
	});

	controller.on('user_morning_ping', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		// IncluderSlackUserId is the one who's actually using Toki

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var nickName = user.nickName;
			var tz = user.SlackUser.tz;


			var day = (0, _momentTimezone2.default)().tz(tz).format('dddd');
			var daySplit = (0, _miscHelpers.getCurrentDaySplit)(tz);

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var goodMorningMessage = 'Good ' + daySplit + ', ' + nickName + '!';
				var quote = (0, _messageHelpers.getRandomQuote)();

				convo.say({
					text: goodMorningMessage + '\n*_"' + quote.message + '"_*\n-' + quote.author,
					attachments: [{
						attachment_type: 'default',
						callback_id: "MORNING_PING_START_DAY",
						fallback: "Let's start the day?",
						color: _constants.colorsHash.grey.hex,
						actions: [{
							name: _constants.buttonValues.letsWinTheDay.name,
							text: ":pencil:Let’s win the day:trophy:",
							value: _constants.buttonValues.letsWinTheDay.value,
							type: "button",
							style: "primary"
						}]
					}]
				});
			});
		});
	});

	controller.hears([_constants.constants.THANK_YOU.reg_exp], 'direct_message', function (bot, message) {
		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "You're welcome!! :smile:");
			(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
		}, 500);
	});

	/**
  * DEFAULT FALLBACK
  */
	controller.hears([_constants.constants.ANY_CHARACTER.reg_exp], 'direct_message', function (bot, message) {
		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
			(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
		}, 500);
	});

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', _index.wit.hears, function (bot, message) {

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});
		}
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function TEMPLATE_FOR_TEST(bot, message) {

	var SlackUserId = message.user;

	_models2.default.User.find({
		where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
		include: [_models2.default.SlackUser]
	}).then(function (user) {

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			var name = user.nickName || user.email;

			// on finish convo
			convo.on('end', function (convo) {});
		});
	});
}
//# sourceMappingURL=index.js.map