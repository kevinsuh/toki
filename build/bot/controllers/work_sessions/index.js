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
  * 		IS_BACK ("READY TO WORK" - Peon WC3)
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

				var shouldStartNewDay = false;

				// 1. has user started day yet?
				user.getSessionGroups({
					order: '"SessionGroup"."createdAt" DESC',
					limit: 1
				}).then(function (sessionGroups) {

					if (sessionGroups.length == 0) {
						shouldStartNewDay = true;
					} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
						shouldStartNewDay = true;
					}

					user.getWorkSessions({
						where: ['"WorkSession"."endTime" > ? ', _constants.startDayExpirationTime]
					}).then(function (workSessions) {

						if (workSessions.length == 0) {
							shouldStartNewDay = true;
						}

						var config = { SlackUserId: SlackUserId, shouldStartNewDay: shouldStartNewDay };
						controller.trigger('is_back_flow', [bot, config]);
					});
				});
			});
		}, 1000);
	});

	controller.on('is_back_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var shouldStartNewDay = config.shouldStartNewDay;

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			user.getDailyTasks({
				where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
				include: [_models2.default.Task],
				order: '"DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {

				dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.isBack = {
						SlackUserId: SlackUserId,
						shouldStartNewDay: shouldStartNewDay,
						isBackDecision: false // what user wants to do
					};

					var name = user.nickName || user.email;

					// give response based on state user is in
					if (shouldStartNewDay) {
						convo.say('Welcome back, ' + name + '!');
						if (dailyTasks.length > 0) {
							convo.say('Here are your priorities from our last time together:\n' + taskListMessage);
						}
						shouldStartNewDayFlow(err, convo);
					} else {
						convo.say('Welcome back, ' + name + '!');
						if (dailyTasks.length > 0) {
							convo.say('Here are your current priorities: ' + taskListMessage);
						}
						shouldStartSessionFlow(err, convo);
					}

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
								case _intents2.default.START_DAY:
									controller.trigger('begin_day_flow', [bot, config]);
									break;
								case _intents2.default.START_SESSION:
									config.intent = _intents2.default.START_SESSION;
									controller.trigger('new_session_group_decision', [bot, config]);
									break;
								case _intents2.default.REMINDER:
									controller.trigger('ask_for_reminder', [bot, config]);
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

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _botResponses = require('../../lib/botResponses');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// user should start a new day


// base controller for work sessions!
function shouldStartNewDayFlow(err, convo) {

	convo.ask({
		text: 'Ready to make a plan for today? If the above tasks are what you want to work on, we can start a session with those instead :pick:',
		attachments: [{
			attachment_type: 'default',
			callback_id: "IS_BACK_START_DAY",
			fallback: "You should start a new day",
			actions: [{
				name: _constants.buttonValues.startDay.name,
				text: "Plan :memo:",
				value: _constants.buttonValues.startDay.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.startSession.name,
				text: "Start session",
				value: _constants.buttonValues.startSession.value,
				type: "button"
			}, {
				name: _constants.buttonValues.createReminder.name,
				text: "Create reminder",
				value: _constants.buttonValues.createReminder.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End day",
				value: _constants.buttonValues.endDay.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.startDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {
			convo.say('Let\'s do it!');
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.specificYes,
		callback: function callback(response, convo) {
			convo.say('Let\'s do it!');
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startSession.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startSession.value
		pattern: _botResponses.utterances.startSession,
		callback: function callback(response, convo) {
			convo.say('Let\'s kick off a new session :soccer:');
			convo.isBackDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.createReminder.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.REMINDER;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.createReminder.value
		pattern: _botResponses.utterances.containsCheckin,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.REMINDER;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.endDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.endDay.value
		pattern: _botResponses.utterances.containsEnd,
		callback: function callback(response, convo) {
			convo.say('It\'s about that time, isn\'t it?');
			convo.isBackDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// user should start a session
function shouldStartSessionFlow(err, convo) {

	convo.ask({
		text: 'Ready to start another session?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "IS_BACK_START_SESSION",
			fallback: "You should start a new session",
			actions: [{
				name: _constants.buttonValues.startSession.name,
				text: "Start session :muscle:",
				value: _constants.buttonValues.startSession.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.createReminder.name,
				text: "Create reminder",
				value: _constants.buttonValues.createReminder.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End day",
				value: _constants.buttonValues.endDay.value,
				type: "button"
			}, {
				name: _constants.buttonValues.startDay.name,
				text: "Create new Plan",
				value: _constants.buttonValues.startDay.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.startDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {
			convo.say('Let\'s do it!');
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startSession.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startSession.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.createReminder.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.REMINDER;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.createReminder.value
		pattern: _botResponses.utterances.containsCheckin,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.REMINDER;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.endDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.endDay.value
		pattern: _botResponses.utterances.containsEnd,
		callback: function callback(response, convo) {
			convo.say('It\'s about that time, isn\'t it?');
			convo.isBackDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}
//# sourceMappingURL=index.js.map