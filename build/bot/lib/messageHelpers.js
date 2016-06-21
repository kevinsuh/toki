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
	var taskListMessage = '';
	var count = 1;

	if (taskArray.length == 0) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		return taskListMessage;
	}

	taskArray.forEach(function (task) {

		// for when you get task from DB
		if (task.dataValues) {
			task = task.dataValues;
		}

		var minutesMessage = task.minutes ? ' (' + task.minutes + ' minutes)' : '';
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
//# sourceMappingURL=messageHelpers.js.map