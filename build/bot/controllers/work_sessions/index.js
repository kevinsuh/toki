'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 		INDEX functions of work sessions
  */

	(0, _startWorkSession2.default)(controller);
	(0, _middleWorkSession2.default)(controller);
	(0, _endWorkSession2.default)(controller);

	/**
  * 		IS_BACK ("READY TO WORK" - Peon WCIII)
  */

	controller.hears(['is_back'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			// find user then reply
			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				// temporary fix to get tasks
				var timeAgoForTasks = (0, _momentTimezone2.default)().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");
				user.getDailyTasks({
					where: ['"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?', timeAgoForTasks, false, "live"],
					include: [_models2.default.Task],
					order: '"DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
					var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

					bot.startConversation(message, function (err, convo) {

						convo.isBack = {
							SlackUserId: SlackUserId,
							isBackDecision: false // what user wants to do
						};

						var name = user.nickName || user.email;

						convo.say('Welcome back, ' + name + '!');
						if (dailyTasks.length > 0) {
							convo.say('Here are your priorities from our last time together:\n' + taskListMessage);
						}
						var options = ["• start a work session with your most recent priorities", "• view your tasks", "• add task(s)", "• end our day together"];
						var optionsList = "";
						options.forEach(function (option) {
							optionsList = optionsList + '> ' + option + '\n';
						});
						convo.ask('What would you like to do now? I can help you with any of these things:\n' + optionsList, function (response, convo) {
							// should eventually contain logic for 5 hour start_day vs start_session
							var entities = response.intentObject.entities;
							var intent = entities.intent;

							var intentValue = intent && intent[0] ? intent[0].value : null;

							if (intentValue) {
								switch (intentValue) {
									case _intents2.default.START_SESSION:
										convo.isBackDecision = _intents2.default.START_SESSION;
										break;
									case _intents2.default.END_DAY:
										convo.isBackDecision = _intents2.default.END_DAY;
										convo.say('It\'s about that time, isn\'t it?');
										break;
									case _intents2.default.VIEW_TASKS:
										convo.isBackDecision = _intents2.default.VIEW_TASKS;
										convo.say('That sounds great. Let\'s decide what to do today! :tangerine:');
										break;
									case _intents2.default.ADD_TASK:
										convo.isBackDecision = _intents2.default.ADD_TASK;
										convo.say('Awesome. Let\'s add some tasks :muscle:');
										break;
									default:
										convo.say('Totally cool, just let me know when you\'re ready to do either of those things! :wave:');
										break;
								}
							}
							convo.next();
						});
						convo.on('end', function (convo) {

							// cancel all `break` and `work_session` type reminders
							user.getReminders({
								where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break"]]
							}).then(function (reminders) {
								reminders.forEach(function (reminder) {
									reminder.update({
										"open": false
									});
								});
							});

							var isBackDecision = convo.isBackDecision;

							var config = { SlackUserId: SlackUserId };
							if (convo.status == 'completed') {
								switch (isBackDecision) {
									case _intents2.default.START_SESSION:
										config.intent = _intents2.default.START_SESSION;
										controller.trigger('new_session_group_decision', [bot, config]);
										break;
									case _intents2.default.END_DAY:
										config.intent = _intents2.default.END_DAY;
										controller.trigger('new_session_group_decision', [bot, config]);
										break;
									case _intents2.default.VIEW_TASKS:
										config.intent = _intents2.default.VIEW_TASKS;
										controller.trigger('new_session_group_decision', [bot, config]);
										break;
									case _intents2.default.ADD_TASK:
										config.intent = _intents2.default.ADD_TASK;
										controller.trigger('new_session_group_decision', [bot, config]);
									default:
										break;
								}
							} else {
								bot.reply(message, "Okay! Let me know when you want to start a session or day");
							}
						});
					});
				});
			});
		}, 1000);
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _endWorkSession = require('./endWorkSession');

var _endWorkSession2 = _interopRequireDefault(_endWorkSession);

var _middleWorkSession = require('./middleWorkSession');

var _middleWorkSession2 = _interopRequireDefault(_middleWorkSession);

var _startWorkSession = require('./startWorkSession');

var _startWorkSession2 = _interopRequireDefault(_startWorkSession);

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for work sessions
//# sourceMappingURL=index.js.map