import models from '../../app/models';
import moment from 'moment-timezone';
import { constants, buttonValues, colorsHash } from './constants';

export function getSlackUsersFromString(string) {
	let arrayString = string.split(/[<@>]/);
	let slackUsers = [];
	arrayString.forEach((string) => {
		if (string[0] === "U") {
			slackUsers.push(string);
		}
	});
	if (slackUsers.length == 0) {
		return false;
	} else {
		return slackUsers;
	}
}

export function getCurrentDaySplit(tz) {
	let daySplit = '';
	let currentHour = moment().tz(tz).format("HH");
	if (currentHour >= constants.AFTERNOON.hour && currentHour <= constants.EVENING.hour && false) {
		daySplit = constants.AFTERNOON.word;
	} else if (currentHour >= constants.EVENING.hour) {
		daySplit = constants.EVENING.word;
	} else {
		daySplit = constants.MORNING.word;
	}
	return daySplit;
}


/**
 * this creates a moment object that takes in a timestamp
 * makes it timestamp neutral, then creates a moment-timezone obj
 * with your passed in timezone
 * @param  {string} timestamp "YYYY-MM-DDTHH:mm:ss.SSS-ZZ"
 * @param  {string} timezone  "America_Los_Angeles"
 * @return {moment}           object with time matched to that specific tz
 */
export function createMomentObjectWithSpecificTimeZone(timeStamp, timeZone) {
	var timeStampArray = timeStamp.split("-");
	timeStampArray.pop();
	timeStamp = timeStampArray.join("-");
	var momentTimezone = moment.tz(timeStamp, timeZone);
	return momentTimezone;
}

/**
 * takes wit timestring and returns a moment timezone
 * ~ we are always assuming user means the SOONEST FUTURE time from now ~
 * 
 * @param  {string} timeString full Wit timestamp string, ex. `2016-06-24T16:24:00.000-04:00`
 * @param  {string} timeZone   timezone in DB, ex. `America/Los_Angeles`
 * @return {moment}            moment object with appropriate timezone
 */
export function dateStringToMomentTimeZone(timeString, timeZone) {

	// turns `2016-06-24T16:24:00.000-04:00` into `["2016", "06", "24", "16:24:00.000", "04:00"]`
	var splitter = new RegExp(/[T-]+/);
	var dateArray = timeString.split(splitter);
	if (dateArray.length != 5) {
		console.log("\n\n\n ~~ THIS IS NOT A CORRECTLY FORMATTED WIT STRING: SHOULD BE FORMAT LIKE `2016-06-24T16:24:00.000-04:00`! ~~ \n\n");
		return false;
	} else if (!timeZone) {
		console.log("\n\n\n ~~ INVALID TIME ZONE. WE NEED A TIME ZONE ~~ \n\n");
		return false;
	}

	var time = dateArray[3]; // ex. "16:24:00.000"
	console.log(`\n\n ~~ working with time: ${time} in timezone: ${timeZone} ~~ \n\n`);
	
	// we must interpret based on user's timezone
	var now     = moment.tz(timeZone);
	var nowTime = now.format("HH:mm:ss");

	var date;
	if (time > nowTime) {
		// user time is greater than now, so we can keep the date
		date = now.format("YYYY-MM-DD");
	} else {
		// user time is less than now, so we assume the NEXT day
		var nextDay = now.add(1, 'days');
		date        = nextDay.format("YYYY-MM-DD");
	}

	var dateTimeFormat = `${date} ${time}`; // string to create our moment obj.
	var userMomentTimezone = moment.tz(dateTimeFormat, timeZone);

	return userMomentTimezone;

}

/**
 * take in time response object and convert it to remindTimeStamp moment obj
 * @param  {obj} response response object
 * @return {moment-tz object}
 */
export function witTimeResponseToTimeZoneObject(response, tz) {

	console.log("\n\n response obj in witTimeResponseToTimeZoneObject \n\n")

	var { intentObject: { entities } } = response;
	const { duration, datetime } = entities;

	var now = moment();
	var remindTimeStamp;
	if ((!datetime && !duration) || !tz) {
		remindTimeStamp = false; // not valid
	} else {

		if (duration) {
			var durationSeconds = 0;
			for (var i = 0; i < duration.length; i++) {
				durationSeconds += duration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);
			remindTimeStamp = now.tz(tz).add(durationSeconds, 'seconds');
		}

		if (datetime) {

			var dateTime = datetime[0]; // 2016-06-24T16:24:00.000-04:00

			// make it the same timestamp
			if (dateTime.type == "interval") {
				remindTimeStamp = dateTime.to.value;
			} else {
				remindTimeStamp = dateTime.value;
			}
			
			// handle if it is a duration configured intent
			if (constants.DURATION_INTENT.reg_exp.test(response.text) && !constants.TIME_INTENT.reg_exp.test(response.text)) {

				console.log("\n\n ~~ interpreted datetime as duration ~~ \n");
				console.log(response.text);
				console.log(remindTimeStamp);
				console.log("\n\n");

				remindTimeStamp = moment(remindTimeStamp).tz(tz);
			} else {
				remindTimeStamp = dateStringToMomentTimeZone(remindTimeStamp, tz);
			}

		}
	}

	return remindTimeStamp;

}

export function witDurationToTimeZoneObject(duration, tz) {
	
	var now = moment();
	var remindTimeStamp;

	if (duration) {
		var durationSeconds = 0;
		for (var i = 0; i < duration.length; i++) {
			durationSeconds += duration[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		remindTimeStamp = now.tz(tz).add(durationSeconds, 'seconds');
		return remindTimeStamp;
	} else {
		return false;
	}
}

// convert wit duration to total minutes
export function witDurationToMinutes(duration) {

	var now = moment();
	var remindTimeStamp;

	if (duration) {
		var durationSeconds = 0;
		for (var i = 0; i < duration.length; i++) {
			durationSeconds += duration[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		return durationMinutes;
	} else {
		return false;
	}

}

// function export our console log functionality
export function consoleLog() {
	console.log("\n\n");
	for (var i = 0; i < arguments.length; i++) {
		var value = arguments[i];
		if (typeof value == "object") {
			console.log(value);
		} else {
			console.log(`~~ ${value} ~~\n`);
		}
	}
	console.log("\n\n");
}

// used to close sessions and reminders
// to avoid cron job pushing in middle of convo
export function closeOldRemindersAndSessions(user) {

	let now = moment().format("YYYY-MM-DD HH:mm:ss Z");

	// cancel old sessions and reminders as early as possible
	user.getReminders({
		where: [ `"open" = ? AND "type" IN (?) AND "Reminder"."createdAt" < ? `, true, ["work_session", "break", "done_session_snooze"], now ]
	}).
	then((oldReminders) => {
		oldReminders.forEach((reminder) => {
			reminder.update({
				"open": false
			})
		});
	});

	var endTime = moment();
	user.getWorkSessions({
		where: [ `"WorkSession"."open" = ? OR "WorkSession"."live" = ? `, true, true ],
		order: `"createdAt" DESC`
	})
	.then((workSessions) => {
		workSessions.forEach((workSession) => {

			const workSessionEndTime = moment(workSession.dataValues.endTime);

			workSession.update({
				open: false,
				live: false
			});

			// only update endTime, if it is sooner than the current workSession endTime!
			if (endTime < workSessionEndTime) {
				workSession.update({
					endTime
				});
			}

			models.StoredWorkSession.update({
				live: false
			}, {
				where: [ `"WorkSessionId" = ?`, workSession.id ]
			});
		});
	});

}

// this re-prioritizes user daily tasks so that
// live and not-completed tasks show up in expected order
// and that priorities are not double-counted
export function prioritizeDailyTasks(user) {

	let today;
	if (user.dataValues && user.dataValues.SlackUser && user.dataValues.SlackUser.tz) {
		const tz = user.dataValues.SlackUser.tz;
		today = moment().tz(tz).format("YYYY-MM-DD Z");
	} else {
		today = moment().format("YYYY-MM-DD Z");
	}

	user.getDailyTasks({
		where: [ `"DailyTask"."type" = ?`, "live" ],
		include: [ models.Task ],
		order: `"Task"."done" = FALSE DESC, "DailyTask"."type" = 'live' DESC, "DailyTask"."updatedAt" ASC, "DailyTask"."priority" ASC`
	})
	.then((dailyTasks) => {
		dailyTasks.forEach((dailyTask, index) => {
			let priority = index + 1;
			dailyTask.update({
				priority
			});
		})
	});

}

// helper function to map time to tasks
export function mapTimeToTaskArray(taskArray, timeToTasksArray) {
	// add time to the tasks
	taskArray = taskArray.map((task, index) => {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return {
			...task,
			minutes: timeToTasksArray[index]
		}
	});
	return taskArray;
}

// get button attachments for your plan list
export function getPlanCommandOptionAttachments(options = {}) {

	let optionsAttachment = [
		{
			attachment_type: 'default',
			callback_id: "PLAN_OPTIONS",
			fallback: "What do you want to do with your plan?",
			color: colorsHash.grey.hex,
			actions: []
		}
	];

	let actions = [ 
		{
			name: buttonValues.planCommands.addTasks.name,
			text: "Add Priority",
			value: buttonValues.planCommands.addTasks.value,
			type: "button"
		},
		{
				name: buttonValues.planCommands.completeTasks.name,
				text: "Complete Priority",
				value: buttonValues.planCommands.completeTasks.value,
				type: "button"
		},
		{
				name: buttonValues.planCommands.deleteTasks.name,
				text: "Delete Priority",
				value: buttonValues.planCommands.deleteTasks.value,
				type: "button"
		},
		{
				name: buttonValues.planCommands.workOnTasks.name,
				text: "New Session",
				value: buttonValues.planCommands.workOnTasks.value,
				type: "button"
		}];

	let { scope } = options;
	actions.forEach((action) => {
		let { value } = action;
		if (scope == "add" && value == buttonValues.planCommands.addTasks.value)
			return;
		if (scope == "complete" && value == buttonValues.planCommands.completeTasks.value)
			return;
		if (scope == "delete" && value == buttonValues.planCommands.deleteTasks.value)
			return;
		if (scope == "work" && value == buttonValues.planCommands.workOnTasks.value)
			return;
		optionsAttachment[0].actions.push(action);
	});
	
	return optionsAttachment;

}

export function getEndOfPlanCommandOptionAttachments(options = {}) {

	let optionsAttachment = [
		{
			attachment_type: 'default',
			callback_id: "END_OF_PLAN_OPTIONS",
			fallback: "What do you want to do with your plan?",
			color: colorsHash.grey.hex,
			actions: []
		}
	];

	let actions = [ 
		{
			name: buttonValues.endOfPlanCommands.addTasks.name,
			text: "Add Tasks",
			value: buttonValues.endOfPlanCommands.addTasks.value,
			type: "button"
		},
		{
				name: buttonValues.endOfPlanCommands.completeTasks.name,
				text: "Check Off Tasks",
				value: buttonValues.endOfPlanCommands.completeTasks.value,
				type: "button"
		},
		{
				name: buttonValues.endOfPlanCommands.deleteTasks.name,
				text: "Delete Tasks",
				value: buttonValues.endOfPlanCommands.deleteTasks.value,
				type: "button"
		},
		{
				name: buttonValues.endOfPlanCommands.workOnTasks.name,
				text: "Work on Tasks",
				value: buttonValues.endOfPlanCommands.workOnTasks.value,
				type: "button"
		}];

	let { scope } = options;
	actions.forEach((action) => {
		let { value } = action;
		if (scope == "add" && value == buttonValues.endOfPlanCommands.addTasks.value)
			return;
		if (scope == "complete" && value == buttonValues.endOfPlanCommands.completeTasks.value)
			return;
		if (scope == "delete" && value == buttonValues.endOfPlanCommands.deleteTasks.value)
			return;
		if (scope == "work" && value == buttonValues.endOfPlanCommands.workOnTasks.value)
			return;
		optionsAttachment[0].actions.push(action);
	});
	
	return optionsAttachment;

}

