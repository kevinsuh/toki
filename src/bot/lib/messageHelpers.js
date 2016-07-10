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
		if (FINISH_WORD.reg_exp.test(task.text)) {
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
	var totalMinutes = 0;

	if (taskArray.length  == 0) {
		console.log("array passed in is empty at convertArrayToTaskListMessage");
		taskListMessage = '> :spiral_note_pad:';
		return taskListMessage;
	}

	console.log("\n\n options passed in to convertArrayToTaskListMessage:");
	console.log(options);
	console.log("\n\n");

	taskArray.forEach((task) => {

		// for when you get task from DB
		var minutesMessage = '';
		if (!options.dontUseDataValues && task.dataValues) {
			task = task.dataValues;
		};

		if (!options.dontShowMinutes && task.minutes) {

			var minutesInt = parseInt(task.minutes);
			if (!isNaN(minutesInt) && !task.done) {
				totalMinutes += minutesInt;
			}
			var timeString = convertMinutesToHoursString(minutesInt);

			if (options.emphasizeMinutes) {
				minutesMessage = ` *_(${timeString})_*`;
			} else {
				minutesMessage = ` (${timeString})`;
			}
		}
		var taskContent = `${count}) ${task.text}${minutesMessage}`;

		taskContent = (task.done ? `~${taskContent}~\n` : `${taskContent}\n`);
		taskContent = (options.noKarets ? taskContent : `> ${taskContent}`);

		taskListMessage += taskContent;
		
		count++;
	});

	if (!options.dontCalculateMinutes) { // taskListMessages default to show calculated minutes
		var timeString = convertMinutesToHoursString(totalMinutes);
		var totalMinutesContent = `\n*Total time estimate: ${timeString} :clock730:*`;
		taskListMessage += totalMinutesContent;
	}

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
		content = `${content}`;
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
	var timeArray = timeString.split(" ");

	var totalMinutesCount = 0; // max of 1
	var totalHoursCount = 0; // max of 1
	for (var i = 0; i < timeArray.length; i++) {
		
		var numberValue = timeArray[i].match(/\d+/);
		if (!numberValue) {
			continue;
		}
			
		var minutes = 0;

		// OPTION 1: int with space (i.e. `1 hr`)
		if (timeArray[i] == parseInt(timeArray[i])) {
			minutes = parseInt(timeArray[i]);
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
				var time = parseInt(element); // can be minutes or hours
				if (isNaN(parseInt(element)))
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

// match the closest message that matches the CHANNEL_ID of this response to the CHANNEL_ID that the bot is speaking to
export function getUpdateTaskListMessageObject(userChannel, bot) {
	
	var { sentMessages } = bot;

	var updateTaskListMessageObject = false;
	if (sentMessages) {
		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = sentMessages.length - 1; i >= 0; i--) {

			var message           = sentMessages[i];
			const { channel, ts } = message;
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


