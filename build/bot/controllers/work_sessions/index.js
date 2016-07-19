'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 		INDEX functions of work sessions
  */

	(0, _startWorkSession2.default)(controller);
	(0, _endWorkSession2.default)(controller);
	(0, _endWorkSessionTimeouts2.default)(controller);

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

				// otherwise, do normal flow
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

							if (sessionGroups[0] && sessionGroups[0].type == "start_work") {
								// if you started a day recently, this can be used as proxy instead of a session
								var startDaySessionTime = (0, _momentTimezone2.default)(sessionGroups[0].createdAt);
								var now = (0, _momentTimezone2.default)();
								var hoursSinceStartDay = _momentTimezone2.default.duration(now.diff(startDaySessionTime)).asHours();
								console.log('hours since start day: ' + hoursSinceStartDay);
								console.log('hours for expiration time: ' + _constants.hoursForExpirationTime);
								if (hoursSinceStartDay > _constants.hoursForExpirationTime) {
									shouldStartNewDay = true;
								}
							} else {
								shouldStartNewDay = true;
							}
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

			user.getWorkSessions({
				where: ['"open" = ?', true],
				order: '"WorkSession"."createdAt" DESC'
			}).then(function (workSessions) {

				var openWorkSession = false;
				if (workSessions.length > 0) {
					var now = (0, _momentTimezone2.default)();
					var endTime = (0, _momentTimezone2.default)(workSessions[0].endTime).add(1, 'minutes');
					if (endTime > now) {
						openWorkSession = workSessions[0];
					}
				}

				user.getDailyTasks({
					where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
					include: [_models2.default.Task],
					order: '"DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
					var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						convo.isBack = {
							openWorkSession: openWorkSession,
							SlackUserId: SlackUserId,
							shouldStartNewDay: shouldStartNewDay,
							dailyTasks: dailyTasks,
							isBackDecision: false // what user wants to do
						};

						var name = user.nickName || user.email;

						// give response based on state user is in
						var message = 'Hey, ' + name + '!';

						if (openWorkSession) {

							openWorkSession.getDailyTasks({
								include: [_models2.default.Task]
							}).then(function (dailyTasks) {

								var now = (0, _momentTimezone2.default)();
								var endTime = (0, _momentTimezone2.default)(openWorkSession.endTime);
								var endTimeString = endTime.format("h:mm a");
								var minutes = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes());
								var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

								var dailyTaskTexts = dailyTasks.map(function (dailyTask) {
									return dailyTask.dataValues.Task.text;
								});

								var sessionTasks = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts);
								message = message + ' You\'re currently in a session for ' + sessionTasks + ' until *' + endTimeString + '* (' + minutesString + ' left)';
								convo.say(message);

								convo.isBack.currentSession = {
									endTime: endTime,
									endTimeString: endTimeString,
									minutesString: minutesString
								};

								currentlyInSessionFlow(err, convo);
								convo.next();
							});
						} else {

							// no currently open sessions
							if (shouldStartNewDay) {
								// start new day!
								if (dailyTasks.length > 0) {
									message = message + ' Here are your priorities from our last time together:\n' + taskListMessage;
								}
								convo.say(message);
								shouldStartNewDayFlow(err, convo);
							} else {
								// start new session!
								if (dailyTasks.length > 0) {
									message = message + ' Here are your current priorities:\n' + taskListMessage;
								}
								convo.say(message);
								shouldStartSessionFlow(err, convo);
							}
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
							var dailyTasksToWorkOn = convo.isBack.dailyTasksToWorkOn;


							var config = { SlackUserId: SlackUserId };
							if (convo.status == 'completed') {
								switch (isBackDecision) {
									case _intents2.default.START_DAY:
										controller.trigger('begin_day_flow', [bot, config]);
										break;
									case _intents2.default.START_SESSION:
										if (dailyTasksToWorkOn) {
											config.dailyTasksToWorkOn = dailyTasksToWorkOn;
										}
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
									case _intents2.default.EDIT_TASKS:
										config.intent = _intents2.default.EDIT_TASKS;
										controller.trigger('new_session_group_decision', [bot, config]);
										break;
									case _intents2.default.ADD_TASK:
										config.intent = _intents2.default.ADD_TASK;
										controller.trigger('new_session_group_decision', [bot, config]);
										break;
									case _intents2.default.END_SESSION:
										controller.trigger('done_session_flow', [bot, config]);
										break;
									default:
										(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
										break;
								}
							} else {
								bot.reply(message, "Okay! Let me know when you want to start a session or day");
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							}
						});
					});
				});
			});
		});
	});
};

exports.checkWorkSessionForLiveTasks = checkWorkSessionForLiveTasks;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _endWorkSession = require('./endWorkSession');

var _endWorkSession2 = _interopRequireDefault(_endWorkSession);

var _endWorkSessionTimeouts = require('./endWorkSessionTimeouts');

var _endWorkSessionTimeouts2 = _interopRequireDefault(_endWorkSessionTimeouts);

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
	var dailyTasks = convo.isBack.dailyTasks;
	var bot = convo.task.bot;


	var message = '*Ready to make a plan for today?*';
	if (dailyTasks.length > 0) {
		message = message + ' If the above tasks are what you want to work on, we can start a session instead `i.e. lets do task 2` :pick:';
	}
	convo.ask({
		text: message,
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
				text: "Set reminder",
				value: _constants.buttonValues.createReminder.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End day",
				value: _constants.buttonValues.endDay.value,
				type: "button"
			}]
		}]
	}, [{ // if user lists tasks, we can infer user wants to start a specific session
		pattern: _botResponses.utterances.containsNumber,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			var tasksToWorkOnString = response.text;
			var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToWorkOnString, dailyTasks);

			if (!taskNumbersToWorkOnArray) {
				convo.say("You didn't pick a valid task to work on :thinking_face:");
				convo.say("You can pick a task from your list `i.e. tasks 1, 3` to work on");
				shouldStartNewDayFlow(response, convo);
				return;
			}

			var dailyTasksToWorkOn = [];
			dailyTasks.forEach(function (dailyTask, index) {
				var taskNumber = index + 1; // b/c index is 0-based
				if (taskNumbersToWorkOnArray.indexOf(taskNumber) > -1) {
					dailyTasksToWorkOn.push(dailyTask);
				}
			});

			convo.isBack.dailyTasksToWorkOn = dailyTasksToWorkOn;
			convo.isBackDecision = _intents2.default.START_SESSION;

			convo.next();
		}
	}, { // user does not want any of the options
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Okay! I\'ll be here whenever you\'re ready to `plan` :wave:');
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Let\'s do it!');
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.specificYes,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

// user is currently in a session
function currentlyInSessionFlow(err, convo) {
	var dailyTasks = convo.isBack.dailyTasks;
	var bot = convo.task.bot;


	convo.ask({
		text: '*What would you like to do?*',
		attachments: [{
			attachment_type: 'default',
			callback_id: "IS_BACK_IN_SESSION",
			fallback: "What would you like to do?",
			actions: [{
				name: _constants.buttonValues.endSessionYes.name,
				text: "End session :punch:",
				value: _constants.buttonValues.endSessionYes.value,
				type: "button"
			}, {
				name: _constants.buttonValues.doneSessionEarlyNo.name,
				text: "Continue Session",
				value: _constants.buttonValues.doneSessionEarlyNo.value,
				type: "button"
			}, {
				name: _constants.buttonValues.editTaskList.name,
				text: "Edit tasks :memo:",
				value: _constants.buttonValues.editTaskList.value,
				type: "button"
			}, {
				name: _constants.buttonValues.startDay.name,
				text: "New Plan",
				value: _constants.buttonValues.startDay.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End day",
				value: _constants.buttonValues.endDay.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.endDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.endDay.value
		pattern: _botResponses.utterances.endDay,
		callback: function callback(response, convo) {

			// this comes first because must include both "end" and "day"
			// (as opposed to "end" for end session)

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('It\'s about that time, isn\'t it?');
			convo.isBackDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.endSessionYes.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.END_SESSION;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.doneSessionYes.value
		pattern: _botResponses.utterances.containsEnd,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.isBackDecision = _intents2.default.END_SESSION;
			convo.next();
		}
	}, { // continue session
		pattern: _constants.buttonValues.doneSessionEarlyNo.value,
		callback: function callback(response, convo) {

			var message = 'Keep crushing :muscle:';
			var currentSession = convo.isBack.currentSession;

			if (currentSession && currentSession.endTimeString) message = 'I\'ll see you at *' + currentSession.endTimeString + '*! ' + message;

			convo.say(message);
			convo.next();
		}
	}, { // same as buttonValues.doneSessionNo.value
		pattern: _botResponses.utterances.containsContinue,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Got it');
			var message = 'Keep crushing :muscle:';
			var currentSession = convo.isBack.currentSession;

			if (currentSession && currentSession.endTimeString) message = 'I\'ll see you at *' + currentSession.endTimeString + '*! ' + message;

			convo.say(message);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.editTaskList.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.EDIT_TASKS;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.doneSessionYes.value
		pattern: _botResponses.utterances.containsEditTaskList,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.isBackDecision = _intents2.default.EDIT_TASKS;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Let\'s do it!');
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.neverMind.value,
		callback: function callback(response, convo) {
			convo.say('I\'ll be here whenever you call :smile_cat:');
			convo.next();
		}
	}, { // NL equivalent to buttonValues.neverMind.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Okay! I\'ll be here whenever you call :smile_cat:');
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
	var dailyTasks = convo.isBack.dailyTasks;
	var bot = convo.task.bot;


	convo.ask({
		text: '*Ready to start another session?* `i.e. lets do task 2`',
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
				text: "Set reminder",
				value: _constants.buttonValues.createReminder.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End day",
				value: _constants.buttonValues.endDay.value,
				type: "button"
			}, {
				name: _constants.buttonValues.startDay.name,
				text: "New Plan",
				value: _constants.buttonValues.startDay.value,
				type: "button"
			}]
		}]
	}, [{ // if user lists tasks, we can infer user wants to start a specific session
		pattern: _botResponses.utterances.containsNumber,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			var tasksToWorkOnString = response.text;
			var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToWorkOnString, dailyTasks);

			if (!taskNumbersToWorkOnArray) {
				convo.say("You didn't pick a valid task to work on :thinking_face:");
				convo.say("You can pick a task from your list `i.e. tasks 1, 3` to work on");
				shouldStartSessionFlow(response, convo);
				return;
			}

			var dailyTasksToWorkOn = [];
			dailyTasks.forEach(function (dailyTask, index) {
				var taskNumber = index + 1; // b/c index is 0-based
				if (taskNumbersToWorkOnArray.indexOf(taskNumber) > -1) {
					dailyTasksToWorkOn.push(dailyTask);
				}
			});

			convo.isBack.dailyTasksToWorkOn = dailyTasksToWorkOn;
			convo.isBackDecision = _intents2.default.START_SESSION;

			convo.next();
		}
	}, { // user does not want any of the options
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Okay! I\'ll be here whenever you\'re ready to `start a session` :hand:');
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startDay.value,
		callback: function callback(response, convo) {
			convo.isBackDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startDay.value
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.isBackDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.createReminder.value,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.isBackDecision = _intents2.default.REMINDER;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.createReminder.value
		pattern: _botResponses.utterances.containsCheckin,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

// check if work session has any live tasks
// if not, ask for a new session
function checkWorkSessionForLiveTasks(config) {
	var controller = config.controller;
	var bot = config.bot;
	var SlackUserId = config.SlackUserId;

	var now = (0, _momentTimezone2.default)();

	/**
  * 		This will check for open work sessions
  * 		if NO tasks are live for open work sessions,
  * 		trigger end and ask for new work session
  */
	_models2.default.User.find({
		where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
		include: [_models2.default.SlackUser]
	}).then(function (user) {

		var UserId = user.id;
		var tz = user.SlackUser.tz;


		user.getWorkSessions({
			where: ['"open" = ?', true]
		}).then(function (workSessions) {

			if (workSessions.length > 0) {

				var openWorkSession = workSessions[0];
				openWorkSession.getDailyTasks({
					include: [_models2.default.Task]
				}).then(function (dailyTasks) {

					var liveTasks = [];

					dailyTasks.forEach(function (dailyTask) {
						var type = dailyTask.type;
						var done = dailyTask.Task.done;

						if (!done && type == "live") {
							liveTasks.push(dailyTask);
						}
					});

					// if no live tasks, end work session and ask for new one
					if (liveTasks.length == 0) {

						var finishedTaskTextsArray = [];
						dailyTasks.forEach(function (dailyTask) {
							finishedTaskTextsArray.push(dailyTask.dataValues.Task.text);
						});
						var finishedTasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(finishedTaskTextsArray);

						openWorkSession.update({
							open: false,
							live: false,
							endTime: now
						}).then(function (workSession) {
							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

								convo.sessionEnd = {
									UserId: UserId,
									tz: tz,
									postSessionDecision: false,
									reminders: [],
									SlackUserId: SlackUserId
								};

								var message = 'Great job finishing ' + finishedTasksString + ' :raised_hands:!';
								convo.say(message);

								(0, _endWorkSession.askUserPostSessionOptions)(err, convo);

								convo.on('end', function (convo) {
									var _convo$sessionEnd = convo.sessionEnd;
									var UserId = _convo$sessionEnd.UserId;
									var postSessionDecision = _convo$sessionEnd.postSessionDecision;
									var reminders = _convo$sessionEnd.reminders;
									var tz = _convo$sessionEnd.tz;

									// create reminders if requested

									reminders.forEach(function (reminder) {
										var remindTime = reminder.remindTime;
										var customNote = reminder.customNote;
										var type = reminder.type;

										_models2.default.Reminder.create({
											UserId: UserId,
											remindTime: remindTime,
											customNote: customNote,
											type: type
										});
									});

									// work session if requested
									(0, _endWorkSession.handlePostSessionDecision)(postSessionDecision, { controller: controller, bot: bot, SlackUserId: SlackUserId });
								});
							});
						});
					} else {
						// inform user how much time is remaining
						// and what tasks are attached to the work session
						var liveTaskTextsArray = [];
						liveTasks.forEach(function (dailyTask) {
							liveTaskTextsArray.push(dailyTask.dataValues.Task.text);
						});
						var liveTasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(liveTaskTextsArray);

						var now = (0, _momentTimezone2.default)();
						var endTime = (0, _momentTimezone2.default)(openWorkSession.dataValues.endTime).tz(tz);
						var endTimeString = endTime.format("h:mm a");
						var minutes = _momentTimezone2.default.duration(endTime.diff(now)).asMinutes();
						var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							convo.say('Good luck finishing ' + liveTasksString + '!');
						});

						(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
					}
				});
			} else {

				user.getDailyTasks({
					where: ['"DailyTask"."type" = ? AND "Task"."done" = ?', "live", false],
					include: [_models2.default.Task]
				}).then(function (dailyTasks) {
					if (dailyTasks.length > 0) {
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.startSession = false;
							convo.ask("Shall we crank out one of your tasks? :wrench:", [{
								pattern: _botResponses.utterances.yes,
								callback: function callback(response, convo) {
									convo.startSession = true;
									convo.next();
								}
							}, {
								pattern: _botResponses.utterances.no,
								callback: function callback(response, convo) {
									convo.say("Okay! I'll be here when you're ready :fist:");
									convo.next();
								}
							}, {
								default: true,
								callback: function callback(response, convo) {
									convo.say("Sorry, I didn't catch that");
									convo.repeat();
									convo.next();
								}
							}]);
							convo.on('end', function (convo) {
								var startSession = convo.startSession;

								if (startSession) {
									var intent = _intents2.default.START_SESSION;

									var config = {
										intent: intent,
										SlackUserId: SlackUserId
									};

									controller.trigger('new_session_group_decision', [bot, config]);
								}
							});
						});
					}
				});
			}
		});
	});
}
//# sourceMappingURL=index.js.map