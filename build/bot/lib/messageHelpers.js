'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
                                                                                                                                                                                                                                                                   */

exports.convertResponseObjectsToTaskArray = convertResponseObjectsToTaskArray;
exports.convertArrayToTaskListMessage = convertArrayToTaskListMessage;
exports.convertTimeStringToMinutes = convertTimeStringToMinutes;
exports.convertToSingleTaskObjectArray = convertToSingleTaskObjectArray;
exports.prioritizeTaskArrayFromUserInput = prioritizeTaskArrayFromUserInput;
exports.commaSeparateOutTaskArray = commaSeparateOutTaskArray;

var _constants = require('./constants');

/**
 * takes array of tasks and converts to array of task STRINGS
 * these "response objects" are botkit MESSAGE response
 * @param  {[object]} tasks task OBJECTS
 * @return {[string]}       task STRINGS
 */
function convertResponseObjectsToTaskArray(tasks) {

	var taskString = '';
	tasks.forEach(function (task, index) {
		// ignore the last one (`done` command)
		if (_constants.FINISH_WORD.reg_exp.test(task.text)) {
			return;
		}

		taskString += task.text;
		taskString += '\n';
	});

	var commaOrNewLine = /[,\n]+/;
	var taskStringArray = taskString.split(commaOrNewLine);
	taskStringArray.pop(); // last one will be \n with this reg ex split

	// this is the final task array we are returning
	var taskArray = [];
	taskStringArray.forEach(function (taskString) {
		taskString = taskString.trim();
		taskArray.push({
			text: taskString
		});
	});

	return taskArray;
}

// this should be called after you `convertToSingleTaskObjectArray`
function convertArrayToTaskListMessage(taskArray) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

	var taskListMessage = '';
	var count = 1;

	if (taskArray.length == 0) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		return taskListMessage;
	}

	console.log("\n\n options passed in to convertArrayToTaskListMessage:");
	console.log(options);
	console.log("\n\n");

	taskArray.forEach(function (task) {

		// for when you get task from DB
		if (!options.dontUseDataValues && task.dataValues) {
			task = task.dataValues;
		};

		var minutesMessage = !options.dontShowMinutes && task.minutes ? ' (' + task.minutes + ' minutes)' : '';
		var taskContent = count + ') ' + task.text + minutesMessage;

		taskContent = task.done ? '> ~' + taskContent + '~\n' : '> ' + taskContent + '\n';
		taskListMessage += taskContent;

		count++;
	});
	return taskListMessage;
}

/**
 * convert a string of hours and minutes to total minutes int
 * @param  {string} string `1hr 2m`, `25 min`, etc.
 * @return {int}        number of minutes int
 * HACKY / temporary solution...
 */
function convertTimeStringToMinutes(timeString) {

	var totalMinutes = 0;
	var timeArray = timeString.split(" ");

	for (var i = 0; i < timeArray.length; i++) {

		if (isNaN(parseInt(timeArray[i]))) continue;

		var minutes = 0;

		// option 1: int with space (i.e. `1 hr`)
		if (timeArray[i] == parseInt(timeArray[i])) {
			minutes = parseInt(timeArray[i]);
			var hourOrMinute = timeArray[i + 1];
			if (hourOrMinute && hourOrMinute[0] == "h") {
				minutes *= 60;
			}
		} else {
			// option 2: int with no space (i.e. `1hr`)
			// use hacky solution...
			var minutes = parseInt(timeArray[i]);
			var minuteString = String(minutes);
			if (timeArray[i][minuteString.length] == "h") {
				minutes *= 60;
			}
		}

		totalMinutes += minutes;
	}

	return totalMinutes;
}

// for simplicity, this converts database calls with all the associations
// into a single JS object for us to decipher as a single task
//
/**
 * converts this into a single task object for consistency sake
 * @param  {[taskObject]} can be DailyTaskArray or TaskArray or WeeklyTaskArray...
 * @param  string type `daily`, `weekly`, etc...
 * @return {[taskObject]} taskObjectArray will always be BASE task with nested dailyTask, weeklyTask, etc.                
 */
function convertToSingleTaskObjectArray(taskObjectArray, type) {

	switch (type) {
		case "daily":
			// if daily task, we need to add content and minutes to userId
			return taskObjectArray.map(function (taskObject) {
				var _taskObject$Task = taskObject.Task;
				var text = _taskObject$Task.text;
				var done = _taskObject$Task.done;
				var UserId = _taskObject$Task.UserId;

				return _extends({}, taskObject, {
					dataValues: _extends({}, taskObject.dataValues, {
						text: text,
						done: done
					})
				});
			});
			break;
		default:
			break;
	}
}

/**
 * return array of tasks mapped to the task numbers that user inputed
 * @param  {array[taskObject]} taskObjectArray 
 * @param  {string} input           i.e. `1, 4, 3, 2`
 * @return {array[TaskObject]}                 
 */
function prioritizeTaskArrayFromUserInput(taskObjectArray, input) {

	// get user priority order (`1,4,3,2`), convert it to an array of ints, and use that to prioritize your array
	var initialPriorityOrder = input;

	// either a non-number, or number > length of tasks
	var isInvalid = false;
	var nonNumberTest = new RegExp(/\D/);
	initialPriorityOrder = initialPriorityOrder.split(",").map(function (order) {
		order = order.trim();
		var orderNumber = parseInt(order);
		if (nonNumberTest.test(order) || orderNumber > taskObjectArray.length) isInvalid = true;
		return orderNumber;
	});

	if (isInvalid) {
		console.log("\n\n\n ~~ User input is invalid ~~ \n\n\n");
		return false;
	}

	var priorityOrder = [];
	var countedNumbers = [];
	initialPriorityOrder.forEach(function (order) {
		if (order > 0) {
			order--; // make user-entered numbers 0-index based

			// let's avoid double-counting
			// only if the order is not already in array (if user says `2,2,2,3` for example)
			if (countedNumbers.indexOf(order) < 0) {
				countedNumbers.push(order);
				priorityOrder.push(order);
			}
		}
	});

	var prioritizedTaskArray = [];
	priorityOrder.forEach(function (order) {
		prioritizedTaskArray.push(taskObjectArray[order]);
	});

	return prioritizedTaskArray;
}

// returns tasks separated into red blocks
function commaSeparateOutTaskArray(a) {

	// put into red blocks
	a = a.map(function (a) {
		return '`' + a + '`';
	});

	// make into string
	var string = [a.slice(0, -1).join(', '), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and ');
	return string;
}
//# sourceMappingURL=messageHelpers.js.map