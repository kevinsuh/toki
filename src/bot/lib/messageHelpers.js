/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

import { constants, buttonValues, colorsHash, taskListMessageNoButtonsAttachment } from './constants';
import { utterances } from './botResponses';

import nlp from 'nlp_compromise';

export function getNewPlanAttachments(prioritizedTasks) {

	let doneTasksButton = "Let's move on";
	if (prioritizedTasks.length  == 1) {
		doneTasksButton = "I only have one";
	} else if (prioritizedTasks.length == 2) {
		doneTasksButton = "I only have two";
	}
	let attachments = [
		{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Let's get your priorities",
			actions: [
				{
						name: buttonValues.doneAddingTasks.name,
						text: doneTasksButton,
						value: buttonValues.doneAddingTasks.value,
						type: "button"
				},
				{
						name: buttonValues.redoTasks.name,
						text: "Start Over",
						value: buttonValues.redoTasks.value,
						type: "button"
				}
			]
		}
	];

	if (prioritizedTasks.length == 0) {
		attachments = [
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "Let's get your priorities"
			}
		]
	}
	return attachments;
}

/**
 * takes array of tasks and converts to array of task STRINGS
 * these "response objects" are botkit MESSAGE response
 * @param  {[object]} tasks task OBJECTS
 * @return {[string]}       task STRINGS
 */
export function convertResponseObjectsToTaskArray(tasks) {

	var taskString = '';
	tasks.forEach((task, index) => {
		// ignore the last one (`done` command)
		// also ignore if it is an `add a task` NL command
		if (constants.FINISH_WORD.reg_exp.test(task.text)) {
			return;
		}

		taskString += task.text;
		taskString += '\n';

	});

	const newLine = /[\n]+/;
	var taskStringArray = taskString.split(newLine);
	taskStringArray.pop(); // last one will be \n with this reg ex split

	// this is the final task array we are returning
	var taskArray = [];
	taskStringArray.forEach((taskString) => {
		taskString = taskString.trim();
		taskArray.push({
			text: taskString
		})
	});

	return taskArray;
}

// converts a response to new task array
// to handle the new lines
export function convertResponseObjectToNewTaskArray(response) {

	var text = response.text;

	const newLine = /[\n]+/;
	var taskStringArray = text.split(newLine);

	var taskArray = [];
	taskStringArray.forEach((taskString) => {
		taskString = taskString.trim();
		taskArray.push({
			text: taskString,
			newTask: true
		})
	});

	return taskArray;

}

/**
 * takes in user input for tasks done `4, 1, 3` and converts it to an array of tasks done. makes sure the task numbers are valid
 * @param  {string} taskCompletedString `4, 1, 3`
 * @param  {[taskObject]} taskArray           the tasks passed in
 * @return {[integer]}                     [4, 1, 3] * if valid *
 */
export function convertTaskNumberStringToArray(taskNumbersString, taskArray) {

	const splitter            = RegExp(/(,|\ba[and]{1,}\b|\bthen\b)/);
	var taskNumbersSplitArray = taskNumbersString.split(splitter);

	// let's get task array of only remaining tasks
	var remainingTasks = getRemainingTasksFromTaskArray(taskArray);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx          = new RegExp(/[\d]+/);
	var validTaskNumberArray = [];
	
	taskNumbersSplitArray.forEach((taskString) => {
		console.log(`task string: ${taskString}`);
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

function getRemainingTasksFromTaskArray(taskArray, options = {}) {
	
	var remainingTasks = [];
	var { newTasks } = options;

	taskArray.forEach((task) => {
		if (!task.done) {
			remainingTasks.push(task);
		}
	});

	if (newTasks) {
		newTasks.forEach((newTask) => {
			remainingTasks.push(newTask);
		})
	}

	return remainingTasks;

}

function getCompletedTasksFromTaskArray(taskArray, options = {}) {

	var completedTasks = [];

	taskArray.forEach((task) => {
		// only live tasks when dealing with existing tasks! (so deleted tasks get ignored)
		if (task.done) {
			completedTasks.push(task);
		}
	});

	return completedTasks;
}

function cleanTaskArray(taskArray) {
	var cleanTaskArray = [];
	taskArray.forEach((task) => {

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
export function convertArrayToTaskListMessage(taskArray, options = {}) {
	var taskListMessage = '';
	var count = 1;
	var totalMinutes = 0;

	options.totalMinutes = totalMinutes;
	options.count        = count;
	
	// different format if has 1+ completed tasks (`segmentCompleted`)
	var hasCompletedTasks = false;
	taskArray.some((task) => {
		if (task.dataValues) {
			task = task.dataValues;
		}
		if (task.done) {
			hasCompletedTasks = true;
			return true;
		}
	});

	var { segmentCompleted, newTasks } = options;

	// cant segment if no completed tasks
	if (!hasCompletedTasks) {
		segmentCompleted = false;
	}

	// dont get deleted tasks
	taskArray = cleanTaskArray(taskArray);

	var remainingTasks = getRemainingTasksFromTaskArray(taskArray, options);
	var completedTasks = getCompletedTasksFromTaskArray(taskArray, options);
	if (options.onlyRemainingTasks)
		completedTasks = [];

	if (taskArray.length  == 0 || (options.onlyRemainingTasks && remainingTasks.length == 0)) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		taskListMessage = '> :spiral_note_pad:';
		return taskListMessage;
	}

	// add completed tasks to right place
	var taskListMessageBody = '';
	if (completedTasks.length > 0) {
		taskListMessage = (options.noKarets ? `*Completed Tasks:*\n` : `> *Completed Tasks:*\n`);
		taskListMessageBody = createTaskListMessageBody(completedTasks, options);
		taskListMessage += taskListMessageBody;
	}
		
	if (remainingTasks.length > 0) {
		// add remaining tasks to right place
		if (completedTasks.length > 0) {
			// only remaining tasks, no completed tasks
			taskListMessage += (options.noKarets ? `\n*Remaining Tasks:*\n` : `>\n>*Remaining Tasks:*\n`);
		}
		taskListMessageBody = createTaskListMessageBody(remainingTasks, options);
		taskListMessage += taskListMessageBody;
	}
	
	if (!options.dontCalculateMinutes && remainingTasks.length > 0) { // taskListMessages default to show calculated minutes
		var { totalMinutes } = options;
		var timeString = convertMinutesToHoursString(totalMinutes);
		var totalMinutesContent = `\n*Total time estimate: ${timeString} :clock730:*`;
		taskListMessage += totalMinutesContent;
	}

	return taskListMessage;
}

function createTaskListMessageBody(taskArray, options) {

	var taskListMessage = '';

	let count = 0;
	taskArray.forEach((task, index) => {

		// for when you get task from DB
		var minutesMessage = '';
		if (!options.dontUseDataValues && task.dataValues) {
			task = task.dataValues;
		};

		let priority = task.priority;
		if (!priority && task.dailyTask && task.DailyTask.dataValues) {
			priority = task.DailyTask.dataValues.priority;
		} else if (!priority) {
			priority = '';
		}

		if (priority > 0) {
			count = priority;
		} else {
			count++;
		}

		if (!options.dontShowMinutes && task.minutes) {

			var minutesInt = parseInt(task.minutes);
			if (!isNaN(minutesInt) && !task.done) {
				options.totalMinutes += minutesInt;
			}
			var timeString = convertMinutesToHoursString(minutesInt);

			if (options.emphasizeMinutes) {
				minutesMessage = ` *_(${timeString})_*`;
			} else {
				minutesMessage = ` (${timeString})`;
			}
		}

		// completed tasks do not have count
		var taskContent = ``;

		// only not completed tasks should have numbers
		if (task.done != true) {
			taskContent = `${count}) `;
		}
		taskContent = `${taskContent}${task.text}${minutesMessage}`

		taskContent = (task.done ? `~${taskContent}~\n` : `${taskContent}\n`);
		taskContent = (options.noKarets ? taskContent : `> ${taskContent}`);

		taskListMessage += taskContent;
		
	});

	return taskListMessage;
}

/**
 * i.e. `75` => `1 hour 15 minutes`
 * @param  {int} minutes number of minutes
 * @return {string}         hour + minutes
 */
export function convertMinutesToHoursString(minutes) {
	minutes = parseInt(minutes);
	var hours = 0;
	while (minutes - 60 >= 0) {
		hours++;
		minutes-=60;
	}
	var content = '';
	if (hours == 0) {
		content = ``;
	} else if (hours == 1) {
		content = `${hours} hour `;
	} else {
		content = `${hours} hours `;
	}

	if (minutes == 0) {
		content = content.slice(0, -1);
	} else if (minutes == 1) {
		content = `${content}${minutes} minute`;
	} else {
		content = `${content}${minutes} minutes`;
	}

	return content;
}

/**
 * convert a string of hours and minutes to total minutes int
 * @param  {string} string `1hr 2m`, `25 min`, etc.
 * @return {int}        number of minutes int
 * HACKY / temporary solution...
 */
export function convertTimeStringToMinutes(timeString) {

	var totalMinutes = 0;
	timeString = timeString.split(/(\d+)/).join(' '); // add proper spaces in b/w numbers so we can then split consistently
	var timeArray = timeString.split(" ");

	var aOrAnRegExp       = new RegExp(/\b[an]{1,3}/i);

	var totalMinutesCount = 0; // max of 1
	var totalHoursCount = 0; // max of 1

	// let's get rid of all space
	timeArray = timeArray.filter((value) => {
		if (value != "")
			return true;
	});

	for (var i = 0; i < timeArray.length; i++) {

		var aOrAnRegExp = new RegExp(/\b[an]{1,3}/i);

		if (nlp.value(timeArray[i]).number) {
			timeArray[i] = `${nlp.value(timeArray[i]).number}`;
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
			var hourOrMinute = timeArray[i+1];
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
			
			timeStringArray.forEach(function(element, index) {
				var time = parseFloat(element); // can be minutes or hours
				if (isNaN(parseFloat(element)))
					return;
				
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
export function convertToSingleTaskObjectArray(taskObjectArray, type) {

	switch (type) {
		case "daily":
			// if daily task, we need to add content and minutes to userId
			return taskObjectArray.map((taskObject) => {
				const { Task: { text, done, UserId } } = taskObject;
				return {
					...taskObject,
					dataValues: {
						...taskObject.dataValues,
						text,
						done
					}
				}
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
export function prioritizeTaskArrayFromUserInput(taskObjectArray, input) {

	// get user priority order (`1,4,3,2`), convert it to an array of ints, and use that to prioritize your array
	var initialPriorityOrder = input;
	
	// either a non-number, or number > length of tasks
	var isInvalid = false;
	var nonNumberTest = new RegExp(/\D/);
	initialPriorityOrder = initialPriorityOrder.split(",").map((order) => {
		order = order.trim();
		var orderNumber = parseInt(order);
		if (nonNumberTest.test(order) || orderNumber > taskObjectArray.length)
			isInvalid = true;
		return orderNumber;
	});

	if (isInvalid) {
		console.log("\n\n\n ~~ User input is invalid ~~ \n\n\n");
		return false;
	}

	var priorityOrder = [];
	var countedNumbers = [];
	initialPriorityOrder.forEach(function(order) {
		if ( order > 0) {
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
	priorityOrder.forEach((order) => {
		prioritizedTaskArray.push(taskObjectArray[order]);
	});

	return prioritizedTaskArray;

}

// returns tasks separated into red blocks
export function commaSeparateOutTaskArray(a) {

	// put into red blocks
	a = a.map((a) => {
		return `\`${a}\``;
	})

	// make into string
	var string = [a.slice(0, -1).join(', '), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and ');
	return string;
}

// new function to ensure you are getting a task list message to update
export function getMostRecentTaskListMessageToUpdate(userChannel, bot, options = {}) {
	
	let { sentMessages } = bot;

	let updateTaskListMessageObject = false;

	let callbackId = "TASK_LIST_MESSAGE";
	const { type } = options;
	if (type) {
		if (type == "plan") {
			callbackId = "PLAN_OPTIONS";
		}
	}

	console.log(sentMessages);

	if (sentMessages && sentMessages[userChannel]) {

		let channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (let i = channelSentMessages.length - 1; i >= 0; i--) {

			let message = channelSentMessages[i];

			const { channel, ts, attachments } = message;
			if (channel == userChannel) {
				if (attachments && attachments[0].callback_id == callbackId) {
					updateTaskListMessageObject = {
						channel,
						ts
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
export function getMostRecentMessageToUpdate(userChannel, bot) {
	
	let { sentMessages } = bot;

	let updateTaskListMessageObject = false;
	if (sentMessages && sentMessages[userChannel]) {

		let channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (let i = channelSentMessages.length - 1; i >= 0; i--) {

			var message = channelSentMessages[i];

			const { channel, ts, attachments } = message;
			if (channel == userChannel) {
				updateTaskListMessageObject = {
					channel,
					ts
				};
				break;
			}
		}
	}

	return updateTaskListMessageObject;

}

// this is for deleting the most recent doneSession message!
// the one that is "hey, did you finish `tasks`"
export function getMostRecentDoneSessionMessage(userChannel, bot) {
	
	let { sentMessages } = bot;

	let messageObject = false;
	if (sentMessages && sentMessages[userChannel]) {

		let channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (let i = channelSentMessages.length - 1; i >= 0; i--) {

			var message = channelSentMessages[i];
			
			const { channel, ts, attachments } = message;
			if (channel == userChannel) {

				if (attachments && attachments[0].callback_id == "DONE_SESSION") {
					messageObject = {
						channel,
						ts
					};
					break;
				}
			}
		}
	}

	return messageObject;

}

// another level of abstraction for this
export function deleteConvoAskMessage(userChannel, bot) {
	// used mostly to delete the button options when answered with NL
	var convoAskMessage = getMostRecentMessageToUpdate(userChannel, bot);
	if (convoAskMessage) {
		bot.api.chat.delete(convoAskMessage);
	}
	
}

export function deleteMostRecentTaskListMessage(userChannel, bot) {
	let taskListMessage = getMostRecentTaskListMessageToUpdate(userChannel, bot);
	if (taskListMessage) {
		bot.api.chat.delete(taskListMessage);
	}
}

export function deleteMostRecentPlanMessage(userChannel, bot) {
	let planMessage = getMostRecentTaskListMessageToUpdate(userChannel, bot, { type: "plan" });
	if (planMessage) {
		bot.api.chat.delete(planMessage);
	}
}

export function deleteMostRecentDoneSessionMessage(userChannel, bot) {
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
export function getTimeToTaskTextAttachmentWithTaskListMessage(taskTextArray, index, taskListMessage) {

	var message = '';
	var taskText = taskTextArray[index];
	if (taskText) {
		message = `How much *time* would you like to allocate to \`${taskText}\`?`;
	}

	var colors = [
		"blue",
		"green",
		"orange",
		"yellow",
		"lavendar"
	];

	var colorChoice = colors[index % colors.length];
	console.log(`\n\n\ncolor choice: ${index} / ${colorChoice}`);
	var color = colorsHash[colorChoice] ? colorsHash[colorChoice].hex : colorsHash.blue.hex;

	var attachments = [
		{
			color: colorsHash.grey.hex,
			attachment_type: "default",
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list",
			mrkdwn_in: ["fields"],
			fields: [
				{
					value: taskListMessage
				}
			]
		}
	];

	var buttonActions = [];
	if (taskText) {
		var addTaskButtonAction = {
			name: buttonValues.actuallyWantToAddATask.name,
			text: "Add more tasks!",
			value: buttonValues.actuallyWantToAddATask.value,
			type: "button"
		};
		buttonActions.push(addTaskButtonAction)
	}
	if (index > 0 && index < taskTextArray.length) {
		var resetTimesButtonAction = {
			name: buttonValues.resetTimes.name,
			text: "Undo Time",
			value: buttonValues.resetTimes.name,
			type: "button",
			style: "danger"
		};
		buttonActions.push(resetTimesButtonAction);
	}
	
	if (attachments[0])
		attachments[0].actions = buttonActions;

	// the specific question to ask
	attachments.push({
		text: message,
		color,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "How long do you want to work on this task?"
	});

	return attachments;
}

/**
 * takes in user input string `i.e. complete tasks 4, 1, 3` and converts it to an array of numbers
 */
export function convertStringToNumbersArray(userInputString) {

	const splitter     = RegExp(/(,|\ba[and]{1,}\b)/);
	var userInputArray = userInputString.split(splitter);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx  = new RegExp(/[\d]+/);
	var numbersArray = [];
	
	userInputArray.forEach((string) => {

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