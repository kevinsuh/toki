'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.showPendingTasks = showPendingTasks;
exports.askForDayTasks = askForDayTasks;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		START DAY CONVERSATION FLOW FUNCTIONS
 */

// show user previous pending tasks to decide on them
function showPendingTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var pendingTasks = convo.dayStart.pendingTasks;


	var options = {
		dontShowMinutes: true,
		dontCalculateMinutes: true
	};
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(pendingTasks, options);
	convo.say("Which of these outstanding tasks would you still like to work on? Just tell me the numbers :1234:");
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "PENDING_TASKS",
			fallback: "Which tasks do you want to work on today?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.noPendingTasks.name,
				text: "None of these",
				value: _constants.buttonValues.noPendingTasks.value,
				type: "button"
			}, {
				name: _constants.buttonValues.neverMind.name,
				text: "Never mind!",
				value: _constants.buttonValues.neverMind.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.noPendingTasks.value,
		callback: function callback(response, convo) {
			askForDayTasks(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.noPendingTasks.value
		pattern: _botResponses.utterances.containsNone,
		callback: function callback(response, convo) {
			convo.say("I like a fresh start each day, too");
			askForDayTasks(response, convo);
			convo.next();
		}
	}, { // user inserts some task numbers
		pattern: _botResponses.utterances.containsNumber,
		callback: function callback(response, convo) {
			savePendingTasksToWorkOn(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.neverMind.value,
		callback: function callback(response, convo) {
			convo.stop();
			convo.next();
		}
	}, { // same as never mind button
		pattern: _botResponses.utterances.startsWithNever,
		callback: function callback(response, convo) {
			convo.stop();
			convo.next();
		}
	}, { // this is failure point
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

function savePendingTasksToWorkOn(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var pendingTasks = convo.dayStart.pendingTasks; // ported from beginning of convo flow

	// get tasks from array

	var userInput = response.text; // i.e. `1, 3, 4, 2`
	var taskArray = (0, _messageHelpers.prioritizeTaskArrayFromUserInput)(pendingTasks, userInput);

	// means user input is invalid
	if (!taskArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		showPendingTasks(response, convo);
		return;
	} else {
		// save this to keep moving on!
		convo.dayStart.taskArray = taskArray;
	}

	var options = {
		dontShowMinutes: true,
		dontCalculateMinutes: true
	};
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var tasks = [];
	taskArray.forEach(function (task) {
		tasks.push(task);
	});

	convo.say("This is starting to look good :sunglasses:");
	convo.say("Which additional tasks would you like to work on with me today? Please send me each task in a separate line");
	convo.say("Then just tell me when you're `done`!");
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "NEW_TASKS",
			fallback: "Which additional tasks do you want to work on?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.noAdditionalTasks.name,
				text: "No additional tasks",
				value: _constants.buttonValues.noAdditionalTasks.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.noAdditionalTasks.value,
		callback: function callback(response, convo) {
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, { // this is additional task added in this case.
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			// should contain none and additional to be
			// NL equivalent to buttonValues.noAdditionalTasks.value
			if (_botResponses.utterances.containsNone.test(response.text) && _botResponses.utterances.containsAdditional.test(response.text)) {
				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();
			} else if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveTaskResponsesToDayStartObject(tasks, convo);
				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();
			} else {
				// you can add tasks here then!
				tasks.push(newTask);
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasks, options);
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);
}

// helper function save convo responses to your taskArray obj
// this will get the new tasks, from whichever part of convo flow
// that you are getting them, then add them to the existing
// `convo.dayStart.taskArray` property
function saveTaskResponsesToDayStartObject(tasks, convo) {

	// add the new tasks to existing pending tasks!
	var taskArray = convo.dayStart.taskArray;


	if (tasks) {

		// only get the new tasks
		var newTasks = [];
		tasks.forEach(function (task) {
			if (task.newTask) {
				newTasks.push(task);
			}
		});
		var newTasksArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(newTasks);
		if (!taskArray) {
			taskArray = [];
		}
		newTasksArray.forEach(function (task) {
			taskArray.push(task);
		});
		convo.dayStart.taskArray = taskArray;
	}
}

// user just started conersation and is entering tasks
function askForDayTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var useHelperText = convo.dayStart.useHelperText;


	var tasks = [];

	if (useHelperText) {
		convo.say("This is where I help you plan the tasks you intend to accomplish each day");
		convo.say("I'll help you walk through this first planning session :dancers: This process will be more streamlined the next time, once you learn how it works :raised_hands:");
	}

	if (useHelperText) {
		convo.say("Don't worry - if the tasks you'd like to work on change, you can update your list by telling me, `I'd like to add a task` or something along those lines :grinning:");
	}

	convo.say('What tasks would you like to work on today? :pencil: Please send me each task in a separate line, and tell me when you\'re `' + _constants.FINISH_WORD.word + '`');

	var options = {
		dontShowMinutes: true,
		dontCalculateMinutes: true
	};
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasks, options);

	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "NEW_TASKS",
			fallback: "What tasks do you want to work on?",
			color: _constants.colorsHash.grey.hex
		}]
	}, [{
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveTaskResponsesToDayStartObject(tasks, convo);
				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();
			} else {
				// you can add tasks here then!
				tasks.push(newTask);
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasks, options);
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);
}

// if user wants to add more tasks
function addMoreTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var taskArray = convo.dayStart.taskArray;

	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var tasks = [];
	taskArray.forEach(function (task) {
		tasks.push(task);
	});

	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "NEW_TASKS",
			fallback: "What tasks do you want to work on?",
			color: _constants.colorsHash.grey.hex
		}]
	}, [{
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveTaskResponsesToDayStartObject(tasks, convo);
				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();
			} else {
				// you can add tasks here then!
				tasks.push(newTask);
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasks, options);
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);
}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {
	var _convo$dayStart = convo.dayStart;
	var taskArray = _convo$dayStart.taskArray;
	var bot = _convo$dayStart.bot;

	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var timeToTasksArray = [];

	convo.say("How much time would you like to allocate to each task?");
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TIME_TO_TASKS",
			fallback: "How much time would you like to allocate to your tasks?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.actuallyWantToAddATask.name,
				text: "Add more tasks!",
				value: _constants.buttonValues.actuallyWantToAddATask.value,
				type: "button"
			}, {
				name: _constants.buttonValues.resetTimes.name,
				text: "Reset times",
				value: _constants.buttonValues.resetTimes.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.actuallyWantToAddATask.value,
		callback: function callback(response, convo) {
			addMoreTasks(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.resetTimes.value,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.dayStart.updateTaskListMessageObject = updateTaskListMessageObject;
				// reset ze task list message
				timeToTasksArray = [];
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, { dontShowMinutes: true });
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		pattern: _constants.RESET.reg_exp,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.dayStart.updateTaskListMessageObject = updateTaskListMessageObject;
				// reset ze task list message
				timeToTasksArray = [];
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, { dontShowMinutes: true });
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);

			if (updateTaskListMessageObject) {
				convo.dayStart.updateTaskListMessageObject = updateTaskListMessageObject;
				var comma = new RegExp(/[,]/);
				var validMinutesTester = new RegExp(/[\dh]/);
				var timeToTasks = response.text.split(comma);

				timeToTasks.forEach(function (time) {
					if (validMinutesTester.test(time)) {
						var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
						timeToTasksArray.push(minutes);
					}
				});

				taskArray = taskArray.map(function (task, index) {
					if (task.dataValues) {
						// task from DB
						return _extends({}, task, {
							minutes: timeToTasksArray[index],
							text: task.dataValues.text
						});
					}
					return _extends({}, task, {
						minutes: timeToTasksArray[index]
					});
				});

				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, { dontUseDataValues: true, emphasizeMinutes: true });

				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}

			if (timeToTasksArray.length >= taskArray.length) {
				convo.dayStart.taskArray = taskArray;
				(0, _miscHelpers.consoleLog)("finished task array!", taskArray);
				confirmTimeToTasks(timeToTasksArray, convo);
				convo.next();
			}
		}
	}]);
}

// this is the work we do to actually assign time to tasks
function confirmTimeToTasks(timeToTasksArray, convo) {

	convo.ask("Are those times right?", [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say(":boom: This looks great!");
			convo.ask("Ready to start a work session?", [{
				pattern: _botResponses.utterances.no,
				callback: function callback(response, convo) {
					convo.say("Great! Let me know when you're ready to `start a session`");
					convo.next();
				}
			}, {
				pattern: _botResponses.utterances.yes,
				callback: function callback(response, convo) {
					convo.dayStart.startDayDecision = _intents2.default.START_SESSION;
					convo.next();
				}
			}], { 'key': 'startFirstSession' });
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Let's give this another try :repeat_one:");
			convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");
			getTimeToTasks(response, convo);
			convo.next();
		}
	}]);
}

/**
 * 		DEPRECATED NOW THAT NO PRIORITIZATION
 * 		~~ if reimplemented will need to re-integrate properly ~~
 */
// user has just entered his tasks for us to display back
function displayTaskList(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var tasks = convo.responses.tasks;
	var prioritizedTaskArray = convo.dayStart.prioritizedTaskArray; // this can be filled if user is passing over pending tasks

	var tasks = convo.responses.tasks;
	var taskArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(tasks);

	// push pending tasks onto user inputed daily tasks
	prioritizedTaskArray.forEach(function (task) {
		taskArray.push(task);
	});

	// taskArray is now attached to convo
	convo.dayStart.taskArray = taskArray;

	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	// we need to prioritize the task list here to display to user
	convo.say('Now, please rank your tasks in order of your priorities today');
	convo.say(taskListMessage);
	convo.ask('You can just list the numbers, like `3, 4, 1, 2, 5`', function (response, convo) {
		prioritizeTaskList(response, convo);
		convo.next();
	}, { 'key': 'taskPriorities' });
}

/**
 * 		DEPRECATED NOW THAT NO PRIORITIZATION
 * 		~~ if reimplemented will need to re-integrate properly ~~
 */
// user has listed `5, 4, 2, 1, 3` for priorities to handle here
function prioritizeTaskList(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	// organize the task list!

	var taskArray = convo.dayStart.taskArray;

	// get tasks from array

	var userInput = response.text; // i.e. `1, 3, 4, 2`
	var prioritizedTaskArray = (0, _messageHelpers.prioritizeTaskArrayFromUserInput)(taskArray, userInput);

	// means user input is invalid
	if (!prioritizedTaskArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		displayTaskList(response, convo);
		return;
	}

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;
	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTaskArray, options);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say("Excellent! Last thing: how much time would you like to allocate to each task today?");
			convo.say(taskListMessage);
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {

			convo.say("Whoops :banana: Let's try to do this again");
			displayTaskList(response, convo);
			convo.next();
		}
	}], { 'key': 'confirmedRightPriority' });
}
//# sourceMappingURL=plan.js.map