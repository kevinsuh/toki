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

				// is user already in a work session?
				user.getWorkSessions({
					where: ['"live" = ?', true]
				}).then(function (workSessions) {

					if (workSessions.length > 0) {
						// user is in a work session
						var config = { SlackUserId: SlackUserId };
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							var name = user.nickName || user.email;
							var message = 'Welcome back, ' + name + '!';
							convo.say(message);

							convo.on('end', function (convo) {
								controller.trigger('confirm_new_session', [bot, config]);
							});
						});
						return;
					}

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
									if (hoursSinceStartDay > _constants.hoursForExpirationTime) {
										shouldStartNewDay = true;
									}
								} else {
									shouldStartNewDay = true;
								}
							}

							var config = { SlackUserId: SlackUserId, shouldStartNewDay: shouldStartNewDay };
							console.log('Config: \n');
							console.log(config);
							controller.trigger('is_back_flow', [bot, config]);
						});
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
						dailyTasks: dailyTasks,
						isBackDecision: false // what user wants to do
					};

					var name = user.nickName || user.email;

					// give response based on state user is in
					var message = 'Welcome back, ' + name + '!';
					if (shouldStartNewDay) {
						if (dailyTasks.length > 0) {
							message = message + ' Here are your priorities from our last time together:\n' + taskListMessage;
						}
						convo.say(message);
						shouldStartNewDayFlow(err, convo);
					} else {
						if (dailyTasks.length > 0) {
							message = message + ' Here are your current priorities:\n' + taskListMessage;
						}
						convo.say(message);
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
	var dailyTasks = convo.isBack.dailyTasks;


	var message = '*Ready to make a plan for today?*';
	if (dailyTasks.length > 0) {
		message = message + ' If the above tasks are what you want to work on, we can start a session with those instead :pick:';
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
	}, [{ // user does not want any of the options
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay! I\'ll be here whenever you\'re ready :hand:');
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
		text: '*Ready to start another session?*',
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
	}, [{ // user does not want any of the options
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay! I\'ll be here whenever you\'re ready :hand:');
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

							convo.say('Good luck with ' + liveTasksString + '!');
							convo.say('I\'ll see you in ' + minutesString + ' at *' + endTimeString + '*. Keep crushing :muscle:');
						});
					}
				});
			} else {
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
	});
}
//# sourceMappingURL=index.js.map