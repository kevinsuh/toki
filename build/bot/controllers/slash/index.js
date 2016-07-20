'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *      SLASH COMMAND FLOW
  */

	controller.on('slash_command', function (bot, message) {

		/*
  	{ token: '1kKzBPfFPOujZiFajN9uRGFe',
  		team_id: 'T121VLM63',
  		team_domain: 'tokihq',
  		channel_id: 'D1J6A98JC',
  		channel_name: 'directmessage',
  		user_id: 'U121ZK15J',
  		user_name: 'kevinsuh',
  		command: '/add',
  		text: 'clean up room for 30 minutes',
  		response_url: 'https://hooks.slack.com/commands/T121VLM63/61639805698/tDr69qc5CsdXdQTaugljw0oP',
  		user: 'U121ZK15J',
  		channel: 'D1J6A98JC',
  		type: 'slash_command',
  		intentObject:
  		 { msg_id: 'c02a017f-10d5-4b24-ab74-ee85c8955b42',
  			 _text: 'clean up room for 30 minutes',
  		 entities: { reminder: [Object], duration: [Object] } } }
   */
		/*
  	{"msg_id":"c02a017f-10d5-4b24-ab74-ee85c8955b42","_text":"clean up room for 30 minutes","entities":{"reminder":[{"confidence":0.9462485198304393,"entities":{},"type":"value","value":"clean up room","suggested":true}],"duration":[{"confidence":0.9997298403843689,"minute":30,"value":30,"unit":"minute","normalized":{"value":1800,"unit":"second"}}]}}
   */

		var SlackUserId = message.user;

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var nickName = user.nickName;
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			// make sure verification token matches!
			if (message.token !== process.env.VERIFICATION_TOKEN) {
				console.log('\n ~~ verification token could not be verified ~~ \n');
				return;
			}

			user.getDailyTasks({
				where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
				include: [_models2.default.Task],
				order: '"DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {

				var now = (0, _momentTimezone2.default)();

				switch (message.command) {
					case "/add":
						var _message$intentObject = message.intentObject.entities;
						var reminder = _message$intentObject.reminder;
						var duration = _message$intentObject.duration;
						var datetime = _message$intentObject.datetime;


						if (reminder) {

							var text = reminder[0].value;
							var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(message, tz);

							if (customTimeObject) {
								var minutes;
								if (duration) {
									minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
								} else {
									minutes = _momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes();
								}

								// we have the task and minutes, create task now
								var newPriority = dailyTasks.length + 1;
								_models2.default.Task.create({
									text: text
								}).then(function (task) {
									_models2.default.DailyTask.create({
										TaskId: task.id,
										priority: newPriority,
										minutes: minutes,
										UserId: UserId
									}).then(function () {
										bot.replyPrivate(message, 'Nice, I added `' + text + ' (' + minutes + ' min)` to your task list! You have ' + newPriority + ' tasks remaining for today :muscle:');
									});
								});
							} else {
								bot.replyPrivate(message, 'Hey, I need to know how long you want to work on `' + text + '` for, either `for 30 min` or `until 3pm`!');
							}
						} else {
							bot.replyPrivate(message, "Hey, I need to know what task you want to work on in order to add it!");
						}
						break;
					case "/help":
					default:
						bot.replyPrivate(message, "I'm sorry, still learning how to " + message.command + "! :dog:");
						break;
				}

				(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
			});
		});
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

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map