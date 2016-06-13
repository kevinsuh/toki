/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

import { FINISH_WORD, EARLY_EXIT_WORDS } from '../controllers/tasks/startDayFlow';


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
		if (task.text == FINISH_WORD)
			return;

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

// this should be called after you `convertToSingleTaskObjectArray`
export function convertArrayToTaskListMessage(taskArray) {
	var taskListMessage = '';
	var count = 1;
	taskArray.forEach((task) => {

		// for when you get task from DB
		if (task.dataValues) {
			task = task.dataValues;
		}

		var minutesMessage = task.minutes ? ` (${task.minutes} minutes)` : '';
		var taskContent = `${count}) ${task.text}${minutesMessage}`;

		taskContent = (task.done ? `> ~${taskContent}~\n` : `> ${taskContent}\n`);
		taskListMessage += taskContent;
		
		count++;
	});
	return taskListMessage;
}

/**
 * convert a string of hours and minutes to total minutes int
 * @param  {string} string `1hr 2m`, `25 min`, etc.
 * @return {int}        number of minutes int
 * very temporary solution...
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
						done,
						UserId
					}
				}
			})
		default:
			break;
	}
}


