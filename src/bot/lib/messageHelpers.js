/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

import { FINISH_WORD } from './constants';
import { utterances } from './botResponses';

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
		if (FINISH_WORD.reg_exp.test(task.text) || (utterances.containsAdd.test(task.text) && utterances.containsTask.test(task.text))) {
			return;
		}

		taskString += task.text;
		taskString += '\n';
	});

	const commaOrNewLine = /[,\n]+/;
	var taskStringArray = taskString.split(commaOrNewLine);
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

/**
 * takes in user input for tasks done `4, 1, 3` and converts it to an array of tasks done. makes sure the task numbers are valid
 * @param  {string} taskCompletedString `4, 1, 3`
 * @param  {[taskObject]} taskArray           the tasks passed in
 * @return {[integer]}                     [4, 1, 3] * if valid *
 */
export function convertTaskNumberStringToArray(taskNumbersString, taskArray) {

	var taskNumbersSplitArray = taskNumbersString.split(/(,|and)/);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx          = new RegExp(/[\d]+/);
	var validTaskNumberArray = [];
	
	taskNumbersSplitArray.forEach((taskString) => {
		console.log(`task string: ${taskString}`);
		var taskNumber = taskString.match(numberRegEx);

		// if it's a valid number and within the taskArray length
		if (taskNumber) {
			taskNumber = parseInt(taskNumber[0]);
			if (taskNumber <= taskArray.length) {
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

// this should be called after you `convertToSingleTaskObjectArray`
export function convertArrayToTaskListMessage(taskArray, options = {}) {
	var taskListMessage = '';
	var count = 1;

	if (taskArray.length  == 0) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		return taskListMessage;
	}

	console.log("\n\n options passed in to convertArrayToTaskListMessage:");
	console.log(options);
	console.log("\n\n");

	taskArray.forEach((task) => {

		// for when you get task from DB
		if (!options.dontUseDataValues && task.dataValues) {
			task = task.dataValues;
		};

		var minutesMessage = (!options.dontShowMinutes && task.minutes) ? ` (${task.minutes} minutes)` : '';
		var taskContent = `${count}) ${task.text}${minutesMessage}`;

		taskContent = (task.done ? `~${taskContent}~\n` : `${taskContent}\n`);
		taskContent = (options.noKarets ? taskContent : `> ${taskContent}`);

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
export function convertTimeStringToMinutes(timeString) {

	var totalMinutes = 0;
	var timeArray = timeString.split(" ");

	for (var i = 0; i < timeArray.length; i++) {
  
  	if (isNaN(parseInt(timeArray[i])))
    	continue;
      
		var minutes = 0;

		// option 1: int with space (i.e. `1 hr`)
		if (timeArray[i] == parseInt(timeArray[i])) {
    	minutes = parseInt(timeArray[i]);
			var hourOrMinute = timeArray[i+1];
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
