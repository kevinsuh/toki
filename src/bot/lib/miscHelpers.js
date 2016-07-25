import models from '../../app/models';
import moment from 'moment-timezone';
import { DURATION_INTENT, TIME_INTENT } from './constants';

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
			if (DURATION_INTENT.reg_exp.test(response.text) && !TIME_INTENT.reg_exp.test(response.text)) {

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

	// cancel old sessions and reminders as early as possible
	user.getReminders({
		where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break", "done_session_snooze"] ]
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
			workSession.update({
				endTime,
				open: false,
				live: false
			});
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
		where: [ `"DailyTask"."createdAt" > ?`, today ],
		include: [ models.Task ],
		order: `"Task"."done" = FALSE DESC, "DailyTask"."type" = 'live' DESC, "DailyTask"."priority" ASC`
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

