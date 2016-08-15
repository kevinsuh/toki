'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
                                                                                                                                                                                                                                                                   */

exports.getRandomApprovalWord = getRandomApprovalWord;
exports.getRandomQuote = getRandomQuote;
exports.getNewPlanAttachments = getNewPlanAttachments;
exports.convertResponseObjectsToTaskArray = convertResponseObjectsToTaskArray;
exports.convertResponseObjectToNewTaskArray = convertResponseObjectToNewTaskArray;
exports.convertTaskNumberStringToArray = convertTaskNumberStringToArray;
exports.convertArrayToTaskListMessage = convertArrayToTaskListMessage;
exports.convertMinutesToHoursString = convertMinutesToHoursString;
exports.convertTimeStringToMinutes = convertTimeStringToMinutes;
exports.convertToSingleTaskObjectArray = convertToSingleTaskObjectArray;
exports.prioritizeTaskArrayFromUserInput = prioritizeTaskArrayFromUserInput;
exports.commaSeparateOutTaskArray = commaSeparateOutTaskArray;
exports.getMostRecentTaskListMessageToUpdate = getMostRecentTaskListMessageToUpdate;
exports.getMostRecentMessageToUpdate = getMostRecentMessageToUpdate;
exports.getMostRecentDoneSessionMessage = getMostRecentDoneSessionMessage;
exports.deleteConvoAskMessage = deleteConvoAskMessage;
exports.deleteMostRecentTaskListMessage = deleteMostRecentTaskListMessage;
exports.deleteMostRecentPlanMessage = deleteMostRecentPlanMessage;
exports.deleteMostRecentDoneSessionMessage = deleteMostRecentDoneSessionMessage;
exports.getTimeToTaskTextAttachmentWithTaskListMessage = getTimeToTaskTextAttachmentWithTaskListMessage;
exports.convertStringToNumbersArray = convertStringToNumbersArray;
exports.getDoneSessionMessageAttachments = getDoneSessionMessageAttachments;
exports.getPlanCommandCenterAttachments = getPlanCommandCenterAttachments;
exports.getMinutesSuggestionAttachments = getMinutesSuggestionAttachments;

var _constants = require('./constants');

var _botResponses = require('./botResponses');

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getRandomApprovalWord() {
	var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

	// gives you awesome, nice, sounds good, great, etc.

	var approvalWord = _constants.approvalWords[Math.floor(Math.random() * _constants.approvalWords.length)];

	if (config.upperCase) {
		approvalWord = capitalizeFirstLetter(approvalWord);
	}
	return approvalWord;
}

function getRandomQuote() {
	var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];


	var quote = _constants.quotes[Math.floor(Math.random() * _constants.quotes.length)];
	return quote;
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function getNewPlanAttachments(prioritizedTasks) {

	var doneTasksButton = "Let's move on";
	if (prioritizedTasks.length == 1) {
		doneTasksButton = "I only have one";
	} else if (prioritizedTasks.length == 2) {
		doneTasksButton = "I only have two";
	}
	var attachments = [{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "Let's get your priorities",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.doneAddingTasks.name,
			text: doneTasksButton,
			value: _constants.buttonValues.doneAddingTasks.value,
			type: "button"
		}, {
			name: _constants.buttonValues.redoTasks.name,
			text: "Start Over",
			value: _constants.buttonValues.redoTasks.value,
			type: "button"
		}]
	}];

	if (prioritizedTasks.length == 0) {
		attachments = [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Let's get your priorities"
		}];
	}
	return attachments;
}

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
		if (_constants.constants.FINISH_WORD.reg_exp.test(task.text)) {
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

// converts a response to new task array
// to handle the new lines
function convertResponseObjectToNewTaskArray(response) {

	var text = response.text;

	var newLine = /[\n]+/;
	var taskStringArray = text.split(newLine);

	var taskArray = [];
	taskStringArray.forEach(function (taskString) {
		taskString = taskString.trim();
		taskArray.push({
			text: taskString,
			newTask: true
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

	var splitter = RegExp(/(,|\ba[and]{1,}\b|\bthen\b)/);
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
			validTaskNumberArray.push(taskNumber);
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
	options.totalMinutesSpent = 0;

	options.totalMinutes = totalMinutes;
	options.count = count;

	var reviewVersion = options.reviewVersion;
	var calculateMinutes = options.calculateMinutes;
	var noTitles = options.noTitles;

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
	if (options.onlyRemainingTasks) completedTasks = [];

	if (taskArray.length == 0 || options.onlyRemainingTasks && remainingTasks.length == 0) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		taskListMessage = '> :spiral_note_pad:';
		return taskListMessage;
	}

	// add completed tasks to right place
	var taskListMessageBody = '';
	if (completedTasks.length > 0) {
		if (!noTitles) {
			taskListMessage = options.noKarets ? '*Completed Priorities:*\n' : '> *Completed Priorities:*\n';
		}

		taskListMessageBody = createTaskListMessageBody(completedTasks, options);
		taskListMessage += taskListMessageBody;
	}

	if (remainingTasks.length > 0) {

		// add remaining tasks to right place
		if (completedTasks.length > 0) {
			// only remaining tasks, no completed tasks
			if (!noTitles) {
				taskListMessage += options.noKarets ? '\n*Remaining Priorities:*\n' : '>\n>*Remaining Priorities:*\n';
			}
		}
		taskListMessageBody = createTaskListMessageBody(remainingTasks, options);
		taskListMessage += taskListMessageBody;
	}

	if (reviewVersion && calculateMinutes) {
		var totalMinutesSpent = options.totalMinutesSpent;

		if (totalMinutesSpent > 0) {
			var timeString = convertMinutesToHoursString(totalMinutesSpent);
			var totalMinutesContent = '\n*Time Well Spent: ' + timeString + ' :clock730:*';
			taskListMessage += totalMinutesContent;
		}
	}

	return taskListMessage;
}

function createTaskListMessageBody(taskArray, options) {

	var taskListMessage = '';

	// if reviewVersion, we are adding the time we SPENT, not what we have remaining
	var reviewVersion = options.reviewVersion;
	var calculateMinutes = options.calculateMinutes;
	var noTitles = options.noTitles;
	var totalMinutesSpent = options.totalMinutesSpent;


	console.log('totalMinutes spent outside loop: ' + totalMinutesSpent);

	var count = 0;
	taskArray.forEach(function (task, index) {

		// for when you get task from DB
		var minutesMessage = '';
		if (!options.dontUseDataValues && task.dataValues) {
			task = task.dataValues;
		};

		if (!options.dontShowMinutes && task.minutes) {

			var minutesInt = Math.round(task.minutes);
			var minutesSpent = Math.round(task.minutesSpent);
			var minutesRemaining = minutesInt - minutesSpent;

			console.log('totalMinutes spent in loop: ' + totalMinutesSpent);

			totalMinutesSpent += minutesSpent;

			var timeString = '';
			if (reviewVersion) {
				// review version: total minutes spent
				timeString = convertMinutesToHoursString(minutesSpent);
				if (minutesSpent > 0) minutesMessage = ' (for ' + timeString + ')';
			} else {
				// live version: total minutes remaining
				if (minutesRemaining > 0) {
					timeString = convertMinutesToHoursString(minutesRemaining);
					minutesMessage = ' (' + timeString + ' remaining)';
				} else {
					if (!task.done) minutesMessage = ' (_no time remaining_)';
				}
			}
		}

		// in review version, only completed tasks for message
		if (reviewVersion && !task.done) {
			return;
		}

		var priority = task.priority;
		if (!priority && task.dailyTask && task.DailyTask.dataValues) {
			priority = task.DailyTask.dataValues.priority;
		} else if (!priority) {
			priority = '';
		}

		if (priority > 0 && !options.dontUsePriority) {
			count = priority;
		} else {
			count++;
		}

		// completed tasks do not have count
		var taskContent = '';

		// only not completed tasks should have numbers
		if (task.done != true || reviewVersion) {
			taskContent = count + ') ';
		}
		taskContent = '' + taskContent + task.text + minutesMessage;

		taskContent = task.done && !reviewVersion ? '~' + taskContent + '~\n' : taskContent + '\n';
		taskContent = options.noKarets ? taskContent : '> ' + taskContent;

		taskListMessage += taskContent;
	});

	options.totalMinutesSpent = totalMinutesSpent;

	return taskListMessage;
}

/**
 * i.e. `75` => `1 hour 15 minutes`
 * @param  {int} minutes number of minutes
 * @return {string}         hour + minutes
 */
function convertMinutesToHoursString(minutes) {
	var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
	var abbreviation = config.abbreviation;


	minutes = Math.round(minutes);
	var hours = 0;
	while (minutes - 60 >= 0) {
		hours++;
		minutes -= 60;
	}
	var content = '';
	if (hours == 0) {
		content = '';
	} else if (hours == 1) {
		content = abbreviation ? hours + ' hr ' : hours + ' hour ';
	} else {
		content = abbreviation ? hours + ' hrs ' : hours + ' hours ';
	}

	if (minutes == 0) {
		content = content.slice(0, -1);
	} else if (minutes == 1) {
		content = abbreviation ? '' + content + minutes + ' min' : '' + content + minutes + ' minute';
	} else {
		content = abbreviation ? '' + content + minutes + ' min' : '' + content + minutes + ' minutes';
	}

	// for 0 time spent
	if (minutes == 0 && hours == 0) {
		content = 'less than a minute';
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
	timeString = timeString.split(/(\d+)/).join(' '); // add proper spaces in b/w numbers so we can then split consistently
	var timeArray = timeString.split(" ");

	var aOrAnRegExp = new RegExp(/\b[an]{1,3}/i);

	var totalMinutesCount = 0; // max of 1
	var totalHoursCount = 0; // max of 1

	// let's get rid of all space
	timeArray = timeArray.filter(function (value) {
		if (value != "") return true;
	});

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
	var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
	var codeBlock = config.codeBlock;
	var slackNames = config.slackNames;


	a = a.map(function (a) {
		if (codeBlock) {
			a = '`' + a + '`';
		} else if (slackNames) {
			a = '@' + a;
		}
		return a;
	});

	// make into string
	var string = [a.slice(0, -1).join(', '), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and ');
	return string;
}

// new function to ensure you are getting a task list message to update
function getMostRecentTaskListMessageToUpdate(userChannel, bot) {
	var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
	var sentMessages = bot.sentMessages;


	var updateTaskListMessageObject = false;

	var callbackId = "TASK_LIST_MESSAGE";
	var type = options.type;

	if (type) {
		if (type == "plan") {
			callbackId = "PLAN_OPTIONS";
		}
	}

	console.log(sentMessages);

	if (sentMessages && sentMessages[userChannel]) {

		var channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = channelSentMessages.length - 1; i >= 0; i--) {

			var message = channelSentMessages[i];

			var channel = message.channel;
			var ts = message.ts;
			var attachments = message.attachments;

			if (channel == userChannel) {
				if (attachments && attachments[0].callback_id == callbackId) {
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
	if (sentMessages && sentMessages[userChannel]) {

		var channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = channelSentMessages.length - 1; i >= 0; i--) {

			var message = channelSentMessages[i];

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

// this is for deleting the most recent doneSession message!
// the one that is "hey, did you finish `tasks`"
function getMostRecentDoneSessionMessage(userChannel, bot) {
	var sentMessages = bot.sentMessages;


	var messageObject = false;
	if (sentMessages && sentMessages[userChannel]) {

		var channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = channelSentMessages.length - 1; i >= 0; i--) {

			var message = channelSentMessages[i];

			var channel = message.channel;
			var ts = message.ts;
			var attachments = message.attachments;

			if (channel == userChannel) {

				if (attachments && attachments[0].callback_id == "DONE_SESSION") {
					messageObject = {
						channel: channel,
						ts: ts
					};
					break;
				}
			}
		}
	}

	return messageObject;
}

// another level of abstraction for this
function deleteConvoAskMessage(userChannel, bot) {
	// used mostly to delete the button options when answered with NL
	var convoAskMessage = getMostRecentMessageToUpdate(userChannel, bot);
	if (convoAskMessage) {
		bot.api.chat.delete(convoAskMessage);
	}
}

function deleteMostRecentTaskListMessage(userChannel, bot) {
	var taskListMessage = getMostRecentTaskListMessageToUpdate(userChannel, bot);
	if (taskListMessage) {
		bot.api.chat.delete(taskListMessage);
	}
}

function deleteMostRecentPlanMessage(userChannel, bot) {
	var planMessage = getMostRecentTaskListMessageToUpdate(userChannel, bot, { type: "plan" });
	if (planMessage) {
		bot.api.chat.delete(planMessage);
	}
}

function deleteMostRecentDoneSessionMessage(userChannel, bot) {
	var doneSessionMessage = getMostRecentDoneSessionMessage(userChannel, bot);
	if (doneSessionMessage) {
		bot.api.chat.delete(doneSessionMessage);
	}
}

/**
 * get task list message with updated texts
 * @param  {[string]} taskTextArray
 * @param  {int} index  which specific taskText
 * @param  {string} taskListMessage 
 * @return {array}                 attachments message
 */
function getTimeToTaskTextAttachmentWithTaskListMessage(taskTextArray, index, taskListMessage) {

	var message = '';
	var taskText = taskTextArray[index];
	if (taskText) {
		message = 'How much *time* would you like to allocate to `' + taskText + '`?';
	}

	var colors = ["blue", "green", "orange", "yellow", "lavendar"];

	var colorChoice = colors[index % colors.length];
	console.log('\n\n\ncolor choice: ' + index + ' / ' + colorChoice);
	var color = _constants.colorsHash[colorChoice] ? _constants.colorsHash[colorChoice].hex : _constants.colorsHash.blue.hex;

	var attachments = [{
		color: _constants.colorsHash.grey.hex,
		attachment_type: "default",
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "Here's your task list",
		mrkdwn_in: ["fields"],
		fields: [{
			value: taskListMessage
		}]
	}];

	var buttonActions = [];
	if (taskText) {
		var addTaskButtonAction = {
			name: _constants.buttonValues.actuallyWantToAddATask.name,
			text: "Add more tasks!",
			value: _constants.buttonValues.actuallyWantToAddATask.value,
			type: "button"
		};
		buttonActions.push(addTaskButtonAction);
	}
	if (index > 0 && index < taskTextArray.length) {
		var resetTimesButtonAction = {
			name: _constants.buttonValues.resetTimes.name,
			text: "Undo Time",
			value: _constants.buttonValues.resetTimes.name,
			type: "button",
			style: "danger"
		};
		buttonActions.push(resetTimesButtonAction);
	}

	if (attachments[0]) attachments[0].actions = buttonActions;

	// the specific question to ask
	attachments.push({
		text: message,
		color: color,
		mrkdwn_in: ["text"],
		attachment_type: "default",
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "How long do you want to work on this task?"
	});

	return attachments;
}

/**
 * takes in user input string `i.e. complete tasks 4, 1, 3` and converts it to an array of numbers
 */
function convertStringToNumbersArray(userInputString) {

	var splitter = RegExp(/(,|\ba[and]{1,}\b)/);
	var userInputArray = userInputString.split(splitter);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx = new RegExp(/[\d]+/);
	var numbersArray = [];

	userInputArray.forEach(function (string) {

		var number = string.match(numberRegEx);

		// if it's a valid number and within the remainingTasks length
		if (number) {
			number = parseInt(number[0]);
			numbersArray.push(number);
		}
	});

	if (numbersArray.length == 0) {
		return false;
	} else {
		return numbersArray;
	}
}

function getDoneSessionMessageAttachments() {
	var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
	var buttonsValuesArray = config.buttonsValuesArray;
	var defaultBreakTime = config.defaultBreakTime;
	var defaultSnoozeTime = config.defaultSnoozeTime;


	var actions = [];
	buttonsValuesArray.forEach(function (buttonValue) {
		switch (buttonValue) {
			case _constants.buttonValues.doneSession.completedPriority.value:
				actions.push({
					name: _constants.buttonValues.doneSession.completedPriority.name,
					text: "Completed :sports_medal:",
					value: _constants.buttonValues.doneSession.completedPriority.value,
					type: "button",
					style: "primary"
				});
				break;
			case _constants.buttonValues.doneSession.completedPriorityTonedDown.value:
				actions.push({
					name: _constants.buttonValues.doneSession.completedPriorityTonedDown.name,
					text: "Completed :punch:",
					value: _constants.buttonValues.doneSession.completedPriorityTonedDown.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.takeBreak.value:
				var breakText = defaultBreakTime ? 'Break for ' + defaultBreakTime + ' min' : 'Take a break';
				actions.push({
					name: _constants.buttonValues.doneSession.takeBreak.name,
					text: breakText,
					value: _constants.buttonValues.doneSession.takeBreak.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.extendSession.value:
				var extendText = defaultSnoozeTime ? 'Extend for ' + defaultSnoozeTime + ' min' : 'Extend Session';
				actions.push({
					name: _constants.buttonValues.doneSession.extendSession.name,
					text: extendText,
					value: _constants.buttonValues.doneSession.extendSession.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.newSession.value:
				actions.push({
					name: _constants.buttonValues.doneSession.newSession.name,
					text: "New Session",
					value: _constants.buttonValues.doneSession.newSession.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.viewPlan.value:
				actions.push({
					name: _constants.buttonValues.doneSession.viewPlan.name,
					text: "View Plan",
					value: _constants.buttonValues.doneSession.viewPlan.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.endDay.value:
				actions.push({
					name: _constants.buttonValues.doneSession.endDay.name,
					text: "End Day",
					value: _constants.buttonValues.doneSession.endDay.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.notDone.value:
				actions.push({
					name: _constants.buttonValues.doneSession.notDone.name,
					text: "Not Done",
					value: _constants.buttonValues.doneSession.notDone.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.didSomethingElse.value:
				actions.push({
					name: _constants.buttonValues.doneSession.didSomethingElse.name,
					text: "Did something else",
					value: _constants.buttonValues.doneSession.didSomethingElse.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.moveOn.value:
				actions.push({
					name: _constants.buttonValues.doneSession.moveOn.name,
					text: "Let's move On",
					value: _constants.buttonValues.doneSession.moveOn.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.itWasSomethingElse.value:
				actions.push({
					name: _constants.buttonValues.doneSession.itWasSomethingElse.name,
					text: "Something else!",
					value: _constants.buttonValues.doneSession.itWasSomethingElse.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.neverMind.value:
				actions.push({
					name: _constants.buttonValues.neverMind.name,
					text: "Never mind",
					value: _constants.buttonValues.neverMind.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.keepMyPriority.value:
				actions.push({
					name: _constants.buttonValues.doneSession.keepMyPriority.name,
					text: "I'll keep my priorities",
					value: _constants.buttonValues.doneSession.keepMyPriority.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.doneSession.beBackLater.value:
				actions.push({
					name: _constants.buttonValues.doneSession.beBackLater.name,
					text: "Be back later",
					value: _constants.buttonValues.doneSession.beBackLater.value,
					type: "button"
				});
				break;
			default:
				break;
		}
	});

	var attachments = [{
		attachment_type: 'default',
		callback_id: "DONE_WITH_SESSION",
		fallback: "Done with my session!",
		actions: actions
	}];

	return attachments;
}

// get button attachments for your plan list
function getPlanCommandCenterAttachments() {
	var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
	var buttonsValuesArray = config.buttonsValuesArray;


	var actions = [];
	buttonsValuesArray.forEach(function (buttonValue) {
		switch (buttonValue) {
			case _constants.buttonValues.planCommands.addPriority.value:
				actions.push({
					name: _constants.buttonValues.planCommands.addPriority.name,
					text: "Add",
					value: _constants.buttonValues.planCommands.addPriority.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.planCommands.deletePriority.value:
				actions.push({
					name: _constants.buttonValues.planCommands.deletePriority.name,
					text: "Remove",
					value: _constants.buttonValues.planCommands.deletePriority.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.planCommands.completePriority.value:
				actions.push({
					name: _constants.buttonValues.planCommands.completePriority.name,
					text: "Complete",
					value: _constants.buttonValues.planCommands.completePriority.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.planCommands.workOnPriority.value:
				actions.push({
					name: _constants.buttonValues.planCommands.workOnPriority.name,
					text: "Work",
					value: _constants.buttonValues.planCommands.workOnPriority.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.planCommands.revisePriority.value:
				actions.push({
					name: _constants.buttonValues.planCommands.revisePriority.name,
					text: "Revise",
					value: _constants.buttonValues.planCommands.revisePriority.value,
					type: "button"
				});
				break;
			case _constants.buttonValues.planCommands.endDay.value:
				actions.push({
					name: _constants.buttonValues.planCommands.endDay.name,
					text: "End Day",
					value: _constants.buttonValues.planCommands.endDay.value,
					type: "button"
				});
				break;
			default:
				break;
		}
	});

	var attachments = [{
		attachment_type: 'default',
		callback_id: "PLAN_COMMAND_CENTER",
		fallback: "What do you want to do with your priorities?",
		color: _constants.colorsHash.toki_purple.hex,
		actions: actions
	}];

	return attachments;
}

function getMinutesSuggestionAttachments(minutesRemaining, config) {

	var minutesSuggestions = [30, 45, 60, 90];
	var customIndexSuggestion = 0;

	minutesSuggestions.some(function (minutesSuggestion, index) {
		customIndexSuggestion = index;

		if (minutesRemaining - minutesSuggestion < 0) {
			return true;
		} else {
			var nextIndex = index + 1;
			if (minutesSuggestions[nextIndex]) {

				if (minutesRemaining - minutesSuggestions[nextIndex] < 0) {

					// round up or down?
					var currentIndexValue = Math.abs(minutesSuggestion - minutesRemaining);
					var nextIndexValue = Math.abs(minutesSuggestions[nextIndex] - minutesRemaining);
					if (nextIndexValue < currentIndexValue) {
						customIndexSuggestion = nextIndex;
					}
					return true;
				}
			}
		}
	});

	if (minutesRemaining > 110) {
		// put a cap on this
		minutesRemaining = 90;
	}

	minutesSuggestions[customIndexSuggestion] = minutesRemaining;

	var attachments = [{
		attachment_type: 'default',
		callback_id: "START_SESSION",
		color: _constants.colorsHash.turquoise.hex,
		fallback: "I was unable to process your decision",
		actions: []
	}];

	minutesSuggestions.forEach(function (minutesSuggestion) {
		var timeSuggestionString = convertMinutesToHoursString(minutesSuggestion, { abbreviation: true });
		var action = {
			name: _constants.buttonValues.startNow.name,
			text: '' + timeSuggestionString,
			value: minutesSuggestion + ' minutes',
			type: "button"
		};
		if (minutesSuggestion == minutesRemaining) {
			action["style"] = "primary";
		}
		attachments[0].actions.push(action);
	});

	var noOtherPriorities = config.noOtherPriorities;

	if (!noOtherPriorities) {
		attachments[0].actions.push({
			name: _constants.buttonValues.changeTask.name,
			text: "Change Priority",
			value: _constants.buttonValues.changeTask.value,
			type: "button"
		});
	}

	return attachments;
}
//# sourceMappingURL=messageHelpers.js.map