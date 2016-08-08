'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.finalizeTimeAndTasksToStart = finalizeTimeAndTasksToStart;
exports.startSessionWithConvoObject = startSessionWithConvoObject;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
function finalizeTimeAndTasksToStart(convo) {
	var _convo$sessionStart = convo.sessionStart;
	var SlackUserId = _convo$sessionStart.SlackUserId;
	var tz = _convo$sessionStart.tz;
	var dailyTask = _convo$sessionStart.dailyTask;
	var calculatedTimeObject = _convo$sessionStart.calculatedTimeObject;
	var minutes = _convo$sessionStart.minutes;
	var currentSession = _convo$sessionStart.currentSession;

	var now = (0, _momentTimezone2.default)();

	// we need both time and task in order to start session
	if (!dailyTask) {
		askWhichTaskToWorkOn(convo);
		return;
	} else if (!calculatedTimeObject || !minutes) {
		confirmTimeForTask(convo);
		return;
	}

	// will only be a single task now
	var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your task';

	// will only be a single task now
	var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
	var calculatedTime = calculatedTimeObject.format("h:mma");

	var question = 'Ready to work on ' + taskText + ' for ' + timeString + ' until *' + calculatedTime + '*?';

	// already in session, can only be in one
	if (currentSession) {

		if (currentSession.isPaused) {
			question = 'You\'re in a *paused* session for `' + currentSession.sessionTasks + '` and have *' + currentSession.minutesString + '* remaining! Would you like to cancel that and start a new session instead?';
		} else {
			question = 'You\'re currently in a session for `' + currentSession.sessionTasks + '` and have *' + currentSession.minutesString + '* remaining! Would you like to cancel that and start a new session instead?';
		}

		convo.ask(question, [{
			pattern: _botResponses.utterances.yes,
			callback: function callback(response, convo) {
				convo.sessionStart.confirmOverRideSession = true;
				convo.say('Okay, sounds good to me!');
				convo.next();
			}
		}, {
			pattern: _botResponses.utterances.no,
			callback: function callback(response, convo) {

				var text = '';
				var attachments = [];

				if (currentSession.isPaused) {
					text = 'Got it. Let me know when you want to *resume* and get going again :arrow_forward:!';
					attachments = _constants.pausedSessionOptionsAttachments;
				} else {
					text = 'Okay! Keep it up and I\'ll see you in ' + currentSession.minutesString + ' :weight_lifter:';
					attachments = _constants.startSessionOptionsAttachments;
				}

				convo.say({
					text: text,
					attachments: attachments
				});

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
	} else {

		// normal flow for starting a session

		var _dailyTask$dataValues = dailyTask.dataValues;
		var _minutes = _dailyTask$dataValues.minutes;
		var minutesSpent = _dailyTask$dataValues.minutesSpent;

		var minutesRemaining = _minutes - minutesSpent;

		if (minutesRemaining > 0) {

			if (minutesSpent == 0) {
				// new flow!
				convo.say('Let’s crank on ' + taskText + ' with a focused session :wrench:');
				question = 'How long would you like to focus on ' + taskText + ' for? You have *' + minutesRemaining + ' minutes* set aside for this today';
			} else {
				// new flow!
				convo.say('Let’s keep cranking on ' + taskText + ' with a focused session :wrench:');
				question = 'How long would you like to focus on ' + taskText + ' for? You still have *' + minutesRemaining + ' minutes* set aside for this today';
			}

			var attachments = (0, _messageHelpers.getMinutesSuggestionAttachments)(minutesRemaining);

			convo.ask({
				text: question,
				attachments: attachments
			}, [{
				pattern: _botResponses.utterances.containsChangeTask,
				callback: function callback(response, convo) {
					convo.say("Okay, let's change tasks!");
					askWhichTaskToWorkOn(convo);
					convo.next();
				}
			}, {
				pattern: _botResponses.utterances.noAndNeverMind,
				callback: function callback(response, convo) {

					convo.sessionStart.confirmStart = false;
					if (currentSession) {
						convo.say({
							text: 'Okay! Good luck on `' + currentSession.sessionTasks + '`. See you at *' + currentSession.endTimeString + '* :weight_lifter:',
							attachments: _constants.startSessionOptionsAttachments
						});
					} else {
						convo.say("Okay, let me know if you still want to start a `new session` for one of your priorities :grin:");
					}
					convo.next();
				}
			}, { // if duration or date, then we can start
				default: true,
				callback: function callback(response, convo) {
					var entities = response.intentObject.entities;


					var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);

					if (customTimeObject) {
						var _minutes2 = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

						convo.sessionStart.calculatedTimeObject = customTimeObject;
						convo.sessionStart.minutes = _minutes2;
						convo.sessionStart.confirmStart = true;

						convo.next();
					} else {
						convo.say("I didn't quite get that :thinking_face:");
						convo.repeat();
						convo.next();
					}
				}
			}]);
		} else {

			confirmTimeForTask(convo);
			convo.next();
		}
	}
}

/**
 *    CHOOSE TASK
 */

// ask which tasks the user wants to work on
function askWhichTaskToWorkOn(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];


	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	var _convo$sessionStart2 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart2.SlackUserId;
	var dailyTasks = _convo$sessionStart2.dailyTasks;
	var dailyTask = _convo$sessionStart2.dailyTask;


	if (!dailyTasks) {
		getUserDailyTasks(convo);
	} else {

		// THIS IS A TEST TO SEE IF THERE ARE EVEN WORKABLE DAILY TASKS
		var oneDailyTaskToWorkOn = (0, _miscHelpers.getDailyTaskForSession)(dailyTasks);
		if (!oneDailyTaskToWorkOn) {
			// THIS SHOULD NEVER HAPPEN
			convo.say('You don\'t have any more priorities to work on! You\'ve won the day!');
			convo.sessionStart.endDay = true;
			convo.next();
		} else {
			(function () {
				var bot = convo.task.bot;

				var noDailyTask = false;
				var taskArray = dailyTasks.filter(function (currentDailyTask) {
					if (!dailyTask) {
						// uncommon situation where reminder has no dailyTask
						noDailyTask = true;
						return true;
					} else if (currentDailyTask.dataValues.id != dailyTask.dataValues.id) {
						return true;
					}
				});
				var options = { dontUsePriority: true };
				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
				if (question == '') {
					question = 'Which priority would you like to work on instead?';
				}
				if (noDailyTask) question = 'Which priority would you like to work on?';
				var message = question + '\n' + taskListMessage;
				convo.ask({
					text: message,
					attachments: [{
						attachment_type: 'default',
						callback_id: "START_SESSION",
						fallback: "I was unable to process your decision",
						color: _constants.colorsHash.grey.hex,
						actions: [{
							name: _constants.buttonValues.neverMind.name,
							text: "Never mind!",
							value: _constants.buttonValues.neverMind.value,
							type: "button"
						}]
					}]
				}, [{
					pattern: _botResponses.utterances.noAndNeverMind,
					callback: function callback(response, convo) {
						if (dailyTask) {
							var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your priority';
							convo.say('Sure thing! Let\'s stay working on ' + taskText);
							confirmTimeForTask(convo);
						} else {
							convo.say('Okay! Let me know when you want to `start a session`');
						}
						convo.next();
					}
				}, {
					default: true,
					callback: function callback(response, convo) {
						// user inputed task #'s, not new task button
						confirmTasks(response, convo, taskArray);
						convo.next();
					}
				}]);
			})();
		}
	}
}

function getUserDailyTasks(convo) {
	var _convo$sessionStart3 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart3.SlackUserId;
	var dailyTask = _convo$sessionStart3.dailyTask;


	_models2.default.User.find({
		where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
		include: [_models2.default.SlackUser]
	}).then(function (user) {
		user.getDailyTasks({
			where: ['"DailyTask"."type" = ?', "live"],
			include: [_models2.default.Task],
			order: '"DailyTask"."priority" ASC'
		}).then(function (dailyTasks) {
			dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
			convo.sessionStart.dailyTasks = dailyTasks;

			// here is where we will automatically suggest a dailyTask based on our specific decision
			// if we can find a dailyTask, we can go straight to confirm
			// Otherwise, we must ask user which one they want to work on
			var dailyTask = (0, _miscHelpers.getDailyTaskForSession)(dailyTasks);
			if (dailyTask) {
				convo.sessionStart.dailyTask = dailyTask;
				finalizeTimeAndTasksToStart(convo);
			} else {
				askWhichTaskToWorkOn(convo);
			}
		});
	});
}

// if user decides to work on existing tasks
function confirmTasks(response, convo) {
	var taskArray = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var dailyTasks = convo.sessionStart.dailyTasks;


	if (taskArray.length == 0) {
		taskArray = dailyTasks;
	}

	var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, taskArray);
	var taskIndexToWorkOn = taskNumbersToWorkOnArray[0] - 1;

	if (taskIndexToWorkOn >= 0) {
		if (taskNumbersToWorkOnArray.length == 1) {
			// SUCCESS
			convo.sessionStart.dailyTask = taskArray[taskIndexToWorkOn];
			confirmTimeForTask(convo);
		} else {
			// only one at a time
			convo.say("Let's work on one priority at a time!");
			var question = "Which of your remaining priorities do you want to work on?";
			askWhichTaskToWorkOn(convo, question);
		}
	} else {
		convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
		var _question = "Which of these do you want to work on?";
		askWhichTaskToWorkOn(convo, _question);
	}
}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTask(convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart4 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart4.SlackUserId;
	var tz = _convo$sessionStart4.tz;
	var dailyTask = _convo$sessionStart4.dailyTask;

	// will only be a single task now

	var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your priority';

	// will only be a single task now
	var minutesAllocated = dailyTask.dataValues.minutes;
	var minutesSpent = dailyTask.dataValues.minutesSpent;

	var minutesRemaining = minutesAllocated - minutesSpent;

	if (minutesRemaining > 0) {

		var now = (0, _momentTimezone2.default)().tz(tz);
		var calculatedTimeObject = now.add(minutesRemaining, 'minutes');

		convo.sessionStart.minutes = minutesRemaining;
		convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

		finalizeTimeAndTasksToStart(convo);
	} else {
		convo.say('You have no time remaining for ' + taskText + ' today!');
		askToAddMinutesToTask(convo);
	}

	convo.next();
}

function askToAddMinutesToTask(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? 'Do you want to complete this for today, or add time to it? (you can say something like `2 more hours`)' : arguments[1];
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart5 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart5.SlackUserId;
	var tz = _convo$sessionStart5.tz;
	var dailyTask = _convo$sessionStart5.dailyTask;

	// will only be a single task now

	var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your priority';
	var now = (0, _momentTimezone2.default)().tz(tz);

	convo.ask({
		text: question,
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			fallback: "Add more minutes to this priority?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.doneSession.completedPriorityTonedDown.name,
				text: "Complete :sports_medal:",
				value: _constants.buttonValues.doneSession.completedPriorityTonedDown.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.containsCompleteOrCheckOrCross,
		callback: function callback(response, convo) {
			convo.say('You are a star :star:');
			convo.sessionStart.completeDailyTask = true;
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var entities = response.intentObject.entities;
			// for time to tasks, these wit intents are the only ones that makes sense

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			if (customTimeObject) {

				var minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

				// add minutes to task and exit
				convo.sessionStart.addMinutesToDailyTask = minutes;

				var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
				convo.say('Woo! I added ' + timeString + ' :raised_hands:');
				convo.next();
			} else {
				// invalid
				convo.say("I'm sorry, I didn't catch that :dog:");
				var _question2 = 'How much more time did you want to add to ' + taskText + ' today?';
				askToAddMinutesToTask(convo, _question2);
			}

			convo.next();
		}
	}]);
};

function confirmCustomTotalMinutes(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;
	var tz = convo.sessionStart.tz;

	var now = (0, _momentTimezone2.default)().tz(tz);

	// use Wit to understand the message in natural language!
	var entities = response.intentObject.entities;


	var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
	var customTimeString = customTimeObject.format("h:mm a");
	var minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

	convo.sessionStart.calculatedTimeObject = customTimeObject;
	convo.sessionStart.minutes = minutes;

	finalizeTimeAndTasksToStart(convo);
}

/**
 * 		ACTUAL START SESSION ABSTRACTION
 */

function startSessionWithConvoObject(sessionStart) {

	// all of these constants are necessary!
	var bot = sessionStart.bot;
	var SlackUserId = sessionStart.SlackUserId;
	var dailyTask = sessionStart.dailyTask;
	var calculatedTimeObject = sessionStart.calculatedTimeObject;
	var UserId = sessionStart.UserId;
	var minutes = sessionStart.minutes;


	if (!bot || !SlackUserId || !UserId || !dailyTask || !calculatedTimeObject || !minutes) {
		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
			convo.say("Uh oh, something went wrong trying to `start your session` :dog: Let me know when you want to try again!");
		});
		return;
	}

	var startTime = (0, _momentTimezone2.default)();
	if (!dailyTask.dataValues.minutes) {
		// update dailyTask minutes here cause it hasn't existed up to this point
		var DailyTaskId = dailyTask.dataValues.id;
		_models2.default.DailyTask.update({
			minutes: minutes
		}, {
			where: ['"id" = ? ', DailyTaskId]
		});
	}
	// endTime is from when you hit start
	var endTime = (0, _momentTimezone2.default)().add(minutes, 'minutes');

	_models2.default.WorkSession.create({
		UserId: UserId,
		startTime: startTime,
		endTime: endTime
	}).then(function (workSession) {

		var dailyTaskIds = [dailyTask.dataValues.id];
		workSession.setDailyTasks(dailyTaskIds);

		var taskString = dailyTask.dataValues.Task.text;
		var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
		var timeString = endTime.format("h:mma");

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say("Let's do it :boom:!");
			convo.say('Good luck with `' + taskString + '`! See you in ' + minutesString + ' at *' + timeString + '*');
			convo.say({
				text: ':weight_lifter: Your focused work session starts now :weight_lifter:',
				attachments: _constants.startSessionOptionsAttachments
			});
		});
	});
}
//# sourceMappingURL=startWorkSessionFunctions.js.map