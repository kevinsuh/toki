'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
                                                                                                                                                                                                                                                                   */

exports.convertResponseObjectsToTaskArray = convertResponseObjectsToTaskArray;
exports.convertTaskNumberStringToArray = convertTaskNumberStringToArray;
exports.convertArrayToTaskListMessage = convertArrayToTaskListMessage;
exports.convertMinutesToHoursString = convertMinutesToHoursString;
exports.convertTimeStringToMinutes = convertTimeStringToMinutes;
exports.convertToSingleTaskObjectArray = convertToSingleTaskObjectArray;
exports.prioritizeTaskArrayFromUserInput = prioritizeTaskArrayFromUserInput;
exports.commaSeparateOutTaskArray = commaSeparateOutTaskArray;
exports.getMostRecentTaskListMessageToUpdate = getMostRecentTaskListMessageToUpdate;
exports.getMostRecentMessageToUpdate = getMostRecentMessageToUpdate;
exports.deleteConvoAskMessage = deleteConvoAskMessage;

var _constants = require('./constants');

var _botResponses = require('./botResponses');

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
		// also ignore if it is an `add a task` NL command
		if (_constants.FINISH_WORD.reg_exp.test(task.text)) {
			return;
		}

		taskString += task.text;
		taskString += '\n';
	});

	var newLine = /[\n]+/;
	var taskStringArray = taskString.split(newLine);
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

/**
 * takes in user input for tasks done `4, 1, 3` and converts it to an array of tasks done. makes sure the task numbers are valid
 * @param  {string} taskCompletedString `4, 1, 3`
 * @param  {[taskObject]} taskArray           the tasks passed in
 * @return {[integer]}                     [4, 1, 3] * if valid *
 */
function convertTaskNumberStringToArray(taskNumbersString, taskArray) {

	var splitter = RegExp(/(,|\ba[and]{1,}\b)/);
	var taskNumbersSplitArray = taskNumbersString.split(splitter);

	// let's get task array of only remaining tasks
	var remainingTasks = getRemainingTasksFromTaskArray(taskArray);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx = new RegExp(/[\d]+/);
	var validTaskNumberArray = [];

	taskNumbersSplitArray.forEach(function (taskString) {
		console.log('task string: ' + taskString);
		var taskNumber = taskString.match(numberRegEx);

		// if it's a valid number and within the remainingTasks length
		if (taskNumber) {
			taskNumber = parseInt(taskNumber[0]);
			if (taskNumber <= remainingTasks.length) {
				validTaskNumberArray.push(taskNumber);
			}
		}
	});

	if (validTaskNumberArray.length == 0) {
		return false;
	} else {
		return validTaskNumberArray;
	}
}

function getRemainingTasksFromTaskArray(taskArray) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];


	var remainingTasks = [];
	var newTasks = options.newTasks;


	taskArray.forEach(function (task) {
		if (!task.done) {
			remainingTasks.push(task);
		}
	});

	if (newTasks) {
		newTasks.forEach(function (newTask) {
			remainingTasks.push(newTask);
		});
	}

	return remainingTasks;
}

function getCompletedTasksFromTaskArray(taskArray) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];


	var completedTasks = [];

	taskArray.forEach(function (task) {
		// only live tasks when dealing with existing tasks! (so deleted tasks get ignored)
		if (task.done) {
			completedTasks.push(task);
		}
	});

	return completedTasks;
}

function cleanTaskArray(taskArray) {
	var cleanTaskArray = [];
	taskArray.forEach(function (task) {

		if (task.dataValues) {
			task = task.dataValues;
		}

		if (!task.type) {
			// this is a newly created task
			cleanTaskArray.push(task);
		} else {
			// existing task
			// right now, do not show deleted and archived tasks
			if (task.type != "deleted" && task.type != "archived") {
				cleanTaskArray.push(task);
			}
		}
	});
	return cleanTaskArray;
}

// this should be called after you `convertToSingleTaskObjectArray`
function convertArrayToTaskListMessage(taskArray) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

	var taskListMessage = '';
	var count = 1;
	var totalMinutes = 0;

	options.totalMinutes = totalMinutes;
	options.count = count;

	if (taskArray.length == 0) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		taskListMessage = '> :spiral_note_pad:';
		return taskListMessage;
	}

	// different format if has 1+ completed tasks (`segmentCompleted`)
	var hasCompletedTasks = false;
	taskArray.some(function (task) {
		if (task.dataValues) {
			task = task.dataValues;
		}
		if (task.done) {
			hasCompletedTasks = true;
			return true;
		}
	});

	var segmentCompleted = options.segmentCompleted;
	var newTasks = options.newTasks;

	// cant segment if no completed tasks

	if (!hasCompletedTasks) {
		segmentCompleted = false;
	}

	// dont get deleted tasks
	taskArray = cleanTaskArray(taskArray);

	var remainingTasks = getRemainingTasksFromTaskArray(taskArray, options);
	var completedTasks = getCompletedTasksFromTaskArray(taskArray, options);

	// add completed tasks to right place
	var taskListMessageBody = '';
	if (completedTasks.length > 0) {
		taskListMessage = options.noKarets ? '*Completed Tasks:*\n' : '> *Completed Tasks:*\n';
		taskListMessageBody = createTaskListMessageBody(completedTasks, options);
		taskListMessage += taskListMessageBody;
	}

	if (remainingTasks.length > 0) {
		// add remaining tasks to right place
		if (completedTasks.length > 0) {
			// only remaining tasks, no completed tasks
			taskListMessage += options.noKarets ? '\n*Remaining Tasks:*\n' : '>\n>*Remaining Tasks:*\n';
		}
		taskListMessageBody = createTaskListMessageBody(remainingTasks, options);
		taskListMessage += taskListMessageBody;
	}

	if (!options.dontCalculateMinutes && remainingTasks.length > 0) {
		// taskListMessages default to show calculated minutes
		var totalMinutes = options.totalMinutes;

		var timeString = convertMinutesToHoursString(totalMinutes);
		var totalMinutesContent = '\n*Total time estimate: ' + timeString + ' :clock730:*';
		taskListMessage += totalMinutesContent;
	}

	return taskListMessage;
}

function createTaskListMessageBody(taskArray, options) {

	var taskListMessage = '';
	var count = options.count;


	taskArray.forEach(function (task, index) {

		// for when you get task from DB
		var minutesMessage = '';
		if (!options.dontUseDataValues && task.dataValues) {
			task = task.dataValues;
		};

		if (!options.dontShowMinutes && task.minutes) {

			var minutesInt = parseInt(task.minutes);
			if (!isNaN(minutesInt) && !task.done) {
				options.totalMinutes += minutesInt;
			}
			var timeString = convertMinutesToHoursString(minutesInt);

			if (options.emphasizeMinutes) {
				minutesMessage = ' *_(' + timeString + ')_*';
			} else {
				minutesMessage = ' (' + timeString + ')';
			}
		}

		// completed tasks do not have count
		var taskContent = '';
		if (!options.segmentCompleted || task.done != true) {
			taskContent = count + ') ';
		}
		taskContent = '' + taskContent + task.text + minutesMessage;

		taskContent = task.done ? '~' + taskContent + '~\n' : taskContent + '\n';
		taskContent = options.noKarets ? taskContent : '> ' + taskContent;

		taskListMessage += taskContent;

		count++;
	});

	return taskListMessage;
}

/**
 * i.e. `75` => `1 hour 15 minutes`
 * @param  {int} minutes number of minutes
 * @return {string}         hour + minutes
 */
function convertMinutesToHoursString(minutes) {
	minutes = parseInt(minutes);
	var hours = 0;
	while (minutes - 60 >= 0) {
		hours++;
		minutes -= 60;
	}
	var content = '';
	if (hours == 0) {
		content = '';
	} else if (hours == 1) {
		content = hours + ' hour ';
	} else {
		content = hours + ' hours ';
	}

	if (minutes == 0) {
		content = content.slice(0, -1);
	} else if (minutes == 1) {
		content = '' + content + minutes + ' minute';
	} else {
		content = '' + content + minutes + ' minutes';
	}

	return content;
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

	var aOrAnRegExp = new RegExp(/\b[an]{1,3}/i);
	var parsedNumberValue = false;

	if (_nlp_compromise2.default.value(timeString).number) {
		parsedNumberValue = '' + _nlp_compromise2.default.value(timeString).number;
	} else if (aOrAnRegExp.test(timeString)) {
		parsedNumberValue = "1";
	}

	var totalMinutesCount = 0; // max of 1
	var totalHoursCount = 0; // max of 1
	for (var i = 0; i < timeArray.length; i++) {

		var aOrAnRegExp = new RegExp(/\b[an]{1,3}/i);

		if (_nlp_compromise2.default.value(timeArray[i]).number) {
			timeArray[i] = '' + _nlp_compromise2.default.value(timeArray[i]).number;
		} else if (aOrAnRegExp.test(timeArray[i])) {
			timeArray[i] = "1";
		}

		var numberValue = timeArray[i].match(/\d+/);
		if (!numberValue) {
			continue;
		}

		// possible we get the number value from outside the split loop
		if (parsedNumberValue) {
			timeArray[i] = parsedNumberValue;
		}

		var minutes = 0;

		// OPTION 1: int with space (i.e. `1 hr`)
		if (timeArray[i] == parseFloat(timeArray[i])) {
			minutes = parseFloat(timeArray[i]);
			var hourOrMinute = timeArray[i + 1];
			if (hourOrMinute && hourOrMinute[0] == "h") {
				minutes *= 60;
				totalHoursCount++;
			} else {
				// number greater than 0
				if (minutes > 0) {
					totalMinutesCount++;
				}
			}
		} else {
			// OPTION 2: No space b/w ints (i.e. 1hr)

			// need to check for "h" or "m" in these instances
			var timeString = timeArray[i];
			var containsH = new RegExp(/[h]/);
			var timeStringArray = timeString.split(containsH);

			timeStringArray.forEach(function (element, index) {
				var time = parseFloat(element); // can be minutes or hours
				if (isNaN(parseFloat(element))) return;

				// if string contains "h", then you can assume first one is hour
				if (containsH.test(timeString)) {
					if (index == 0) {
						// hours
						minutes += 60 * time;
						totalHoursCount++;
					} else {
						// minutes
						minutes += time;
						totalMinutesCount++;
					}
				} else {
					minutes += time;
					totalMinutesCount++;
				}
			});
		}

		if (totalMinutesCount > 1 || totalHoursCount > 1) {
			continue;
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

// new function to ensure you are getting a task list message to update
function getMostRecentTaskListMessageToUpdate(userChannel, bot) {
	var sentMessages = bot.sentMessages;


	var updateTaskListMessageObject = false;
	if (sentMessages) {
		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = sentMessages.length - 1; i >= 0; i--) {

			var message = sentMessages[i];
			var channel = message.channel;
			var ts = message.ts;
			var attachments = message.attachments;

			if (channel == userChannel) {
				if (attachments && attachments[0].callback_id == "TASK_LIST_MESSAGE") {
					updateTaskListMessageObject = {
						channel: channel,
						ts: ts
					};
					break;
				}
			}
		}
	}

	return updateTaskListMessageObject;
}

// this is for deleting the most recent message!
// mainly used for convo.ask, when you do natural language instead
// of clicking the button
function getMostRecentMessageToUpdate(userChannel, bot) {
	var sentMessages = bot.sentMessages;


	var updateTaskListMessageObject = false;
	if (sentMessages) {
		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = sentMessages.length - 1; i >= 0; i--) {

			var message = sentMessages[i];
			var channel = message.channel;
			var ts = message.ts;
			var attachments = message.attachments;

			if (channel == userChannel) {
				updateTaskListMessageObject = {
					channel: channel,
					ts: ts
				};
				break;
			}
		}
	}

	return updateTaskListMessageObject;
}

// another level of abstraction for this
function deleteConvoAskMessage(userChannel, bot) {
	// used mostly to delete the button options when answered with NL
	var convoAskMessage = getMostRecentMessageToUpdate(userChannel, bot);
	bot.api.chat.delete(convoAskMessage);
}
//# sourceMappingURL=messageHelpers.js.map