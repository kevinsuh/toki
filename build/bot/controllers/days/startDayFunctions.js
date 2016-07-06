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
		dontShowMinutes: true
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
			convo.say("I like a fresh start each day, too :tangerine:");
			askForDayTasks(response, convo);
			convo.next();
		}
	}, { // user inserts some task numbers
		pattern: _botResponses.utterances.containsNumber,
		callback: function callback(response, convo) {
			savePendingTasksToWorkOn(response, convo);
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
		dontShowMinutes: true
	};
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var tasks = [];
	convo.say("This is starting to look good :sunglasses:");
	convo.say("Which additional tasks would you like to work on with me today?");
	convo.say("You can enter everything in one line, separated by commas, or send me each task in a separate line");
	convo.ask({
		text: "Then just tell me when you're `done`!",
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
	}, { // NL equivalent to buttonValues.noAdditionalTasks.value
		pattern: _botResponses.utterances.containsNone,
		callback: function callback(response, convo) {
			convo.say("Excellent!");
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, { // this is additional task added in this case.
		default: true,
		callback: function callback(response, convo) {
			tasks.push(response);
			if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveTaskResponsesToDayStartObject(tasks, convo);
				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();
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
		var newTasksArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(tasks);
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


	var tasks = [];
	convo.say('What tasks would you like to work on today? :pencil:');
	convo.ask('Please enter all of the tasks in one line, separated by commas, or just send me each task in a separate line. Then just tell me when you\'re done by saying `' + _constants.FINISH_WORD.word + '`', function (response, convo) {

		for (var i = 0; i < _constants.EXIT_EARLY_WORDS.length; i++) {
			if (response.text == _constants.EXIT_EARLY_WORDS[i]) convo.stop();
		}

		tasks.push(response);
		if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
			saveTaskResponsesToDayStartObject(tasks, convo);
			convo.say("Excellent!");
			getTimeToTasks(response, convo);
			convo.next();
		}
	});
}

// if user wants to add more tasks
function addMoreTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var taskArray = convo.dayStart.taskArray;

	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var tasks = [];
	convo.ask(taskListMessage, function (response, convo) {

		tasks.push(response);

		if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
			saveTaskResponsesToDayStartObject(tasks, convo);
			convo.say("Excellent!");
			getTimeToTasks(response, convo);
			convo.next();
		}
	});
}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {
	var taskArray = convo.dayStart.taskArray;

	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

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
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.actuallyWantToAddATask.value,
		callback: function callback(response, convo) {
			addMoreTasks(response, convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			if (_botResponses.utterances.containsAdd.test(response.text) && _botResponses.utterances.containsTask.test(response.text)) {
				convo.say("Of course - just add another task here and say `done` when you're ready to go");
				// NL equivalent to buttonValues.actuallyWantToAddATask.value
				addMoreTasks(response, convo);
			} else {
				assignTimeToTasks(response, convo);
			}
			convo.next();
		}
	}]);
}

// this is the work we do to actually assign time to tasks
function assignTimeToTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var taskArray = convo.dayStart.taskArray;


	var timeToTask = response.text;

	// need to check for invalid responses.
	// does not say minutes or hours, or is not right length
	var isInvalid = false;
	timeToTask = timeToTask.split(",");
	if (timeToTask.length != taskArray.length) {
		isInvalid = true;
	};

	var validMinutesTester = new RegExp(/[\dh]/);
	timeToTask = timeToTask.map(function (time) {
		if (!validMinutesTester.test(time)) {
			isInvalid = true;
		}
		var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
		return minutes;
	});

	taskArray = taskArray.map(function (task, index) {
		if (task.dataValues) {
			// task from DB
			return _extends({}, task, {
				minutes: timeToTask[index],
				text: task.dataValues.text
			});
		}
		return _extends({}, task, {
			minutes: timeToTask[index]
		});
	});

	// INVALID tester
	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid times :thinking_face:. Let's try this again");
		convo.say("The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
		convo.say("Just say, `30, 40, 50, 1 hour, 15 min` and I'll figure it out and assign those times to the tasks above in order :smiley:");
		getTimeToTasks(response, convo);
		return;
	}

	convo.dayStart.taskArray = taskArray;
	var options = { dontUseDataValues: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	convo.say("Are these times right?");
	convo.ask(taskListMessage, [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say(":boom: This looks great!");
			convo.ask("Ready to start your first focused work session today?", [{
				pattern: _botResponses.utterances.yes,
				callback: function callback(response, convo) {
					convo.dayStart.startDayDecision = _intents2.default.START_SESSION;
					convo.next();
				}
			}, {
				pattern: _botResponses.utterances.no,
				callback: function callback(response, convo) {
					convo.say("Great! Let me know when you're ready to start by saying `start session`");
					convo.next();
				}
			}], { 'key': 'startFirstSession' });
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Let's give this another try :repeat_one:");
			convo.say("The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
			convo.say("Just say, `30, 40, 50, 1 hour, 15 min` and I'll figure it out and assign those times to the tasks above in order :smiley:");
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
//# sourceMappingURL=startDayFunctions.js.map