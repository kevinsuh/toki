'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.createMomentObjectWithSpecificTimeZone = createMomentObjectWithSpecificTimeZone;
exports.dateStringToMomentTimeZone = dateStringToMomentTimeZone;
exports.witTimeResponseToTimeZoneObject = witTimeResponseToTimeZoneObject;
exports.witDurationToTimeZoneObject = witDurationToTimeZoneObject;
exports.witDurationToMinutes = witDurationToMinutes;
exports.consoleLog = consoleLog;
exports.closeOldRemindersAndSessions = closeOldRemindersAndSessions;
exports.prioritizeDailyTasks = prioritizeDailyTasks;
exports.mapTimeToTaskArray = mapTimeToTaskArray;
exports.getPlanCommandOptionAttachments = getPlanCommandOptionAttachments;
exports.getEndOfPlanCommandOptionAttachments = getEndOfPlanCommandOptionAttachments;

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * this creates a moment object that takes in a timestamp
 * makes it timestamp neutral, then creates a moment-timezone obj
 * with your passed in timezone
 * @param  {string} timestamp "YYYY-MM-DDTHH:mm:ss.SSS-ZZ"
 * @param  {string} timezone  "America_Los_Angeles"
 * @return {moment}           object with time matched to that specific tz
 */
function createMomentObjectWithSpecificTimeZone(timeStamp, timeZone) {
	var timeStampArray = timeStamp.split("-");
	timeStampArray.pop();
	timeStamp = timeStampArray.join("-");
	var momentTimezone = _momentTimezone2.default.tz(timeStamp, timeZone);
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
function dateStringToMomentTimeZone(timeString, timeZone) {

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
	console.log('\n\n ~~ working with time: ' + time + ' in timezone: ' + timeZone + ' ~~ \n\n');

	// we must interpret based on user's timezone
	var now = _momentTimezone2.default.tz(timeZone);
	var nowTime = now.format("HH:mm:ss");

	var date;
	if (time > nowTime) {
		// user time is greater than now, so we can keep the date
		date = now.format("YYYY-MM-DD");
	} else {
		// user time is less than now, so we assume the NEXT day
		var nextDay = now.add(1, 'days');
		date = nextDay.format("YYYY-MM-DD");
	}

	var dateTimeFormat = date + ' ' + time; // string to create our moment obj.
	var userMomentTimezone = _momentTimezone2.default.tz(dateTimeFormat, timeZone);

	return userMomentTimezone;
}

/**
 * take in time response object and convert it to remindTimeStamp moment obj
 * @param  {obj} response response object
 * @return {moment-tz object}
 */
function witTimeResponseToTimeZoneObject(response, tz) {

	console.log("\n\n response obj in witTimeResponseToTimeZoneObject \n\n");

	var entities = response.intentObject.entities;
	var duration = entities.duration;
	var datetime = entities.datetime;


	var now = (0, _momentTimezone2.default)();
	var remindTimeStamp;
	if (!datetime && !duration || !tz) {
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
			if (_constants.DURATION_INTENT.reg_exp.test(response.text) && !_constants.TIME_INTENT.reg_exp.test(response.text)) {

				console.log("\n\n ~~ interpreted datetime as duration ~~ \n");
				console.log(response.text);
				console.log(remindTimeStamp);
				console.log("\n\n");

				remindTimeStamp = (0, _momentTimezone2.default)(remindTimeStamp).tz(tz);
			} else {
				remindTimeStamp = dateStringToMomentTimeZone(remindTimeStamp, tz);
			}
		}
	}

	return remindTimeStamp;
}

function witDurationToTimeZoneObject(duration, tz) {

	var now = (0, _momentTimezone2.default)();
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
function witDurationToMinutes(duration) {

	var now = (0, _momentTimezone2.default)();
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
function consoleLog() {
	console.log("\n\n");
	for (var i = 0; i < arguments.length; i++) {
		var value = arguments[i];
		if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) == "object") {
			console.log(value);
		} else {
			console.log('~~ ' + value + ' ~~\n');
		}
	}
	console.log("\n\n");
}

// used to close sessions and reminders
// to avoid cron job pushing in middle of convo
function closeOldRemindersAndSessions(user) {

	// cancel old sessions and reminders as early as possible
	user.getReminders({
		where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break", "done_session_snooze"]]
	}).then(function (oldReminders) {
		oldReminders.forEach(function (reminder) {
			reminder.update({
				"open": false
			});
		});
	});

	var endTime = (0, _momentTimezone2.default)();
	user.getWorkSessions({
		where: ['"WorkSession"."open" = ? OR "WorkSession"."live" = ? ', true, true],
		order: '"createdAt" DESC'
	}).then(function (workSessions) {
		workSessions.forEach(function (workSession) {

			var workSessionEndTime = (0, _momentTimezone2.default)(workSession.dataValues.endTime);

			workSession.update({
				open: false,
				live: false
			});

			// only update endTime, if it is sooner than the current workSession endTime!
			if (endTime < workSessionEndTime) {
				workSession.update({
					endTime: endTime
				});
			}

			_models2.default.StoredWorkSession.update({
				live: false
			}, {
				where: ['"WorkSessionId" = ?', workSession.id]
			});
		});
	});
}

// this re-prioritizes user daily tasks so that
// live and not-completed tasks show up in expected order
// and that priorities are not double-counted
function prioritizeDailyTasks(user) {

	var today = void 0;
	if (user.dataValues && user.dataValues.SlackUser && user.dataValues.SlackUser.tz) {
		var tz = user.dataValues.SlackUser.tz;
		today = (0, _momentTimezone2.default)().tz(tz).format("YYYY-MM-DD Z");
	} else {
		today = (0, _momentTimezone2.default)().format("YYYY-MM-DD Z");
	}

	user.getDailyTasks({
		where: ['"DailyTask"."type" = ?', "live"],
		include: [_models2.default.Task],
		order: '"Task"."done" = FALSE DESC, "DailyTask"."type" = \'live\' DESC, "DailyTask"."updatedAt" ASC, "DailyTask"."priority" ASC'
	}).then(function (dailyTasks) {
		dailyTasks.forEach(function (dailyTask, index) {
			var priority = index + 1;
			dailyTask.update({
				priority: priority
			});
		});
	});
}

// helper function to map time to tasks
function mapTimeToTaskArray(taskArray, timeToTasksArray) {
	// add time to the tasks
	taskArray = taskArray.map(function (task, index) {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return _extends({}, task, {
			minutes: timeToTasksArray[index]
		});
	});
	return taskArray;
}

// get button attachments for your plan list
function getPlanCommandOptionAttachments() {
	var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];


	var optionsAttachment = [{
		attachment_type: 'default',
		callback_id: "PLAN_OPTIONS",
		fallback: "What do you want to do with your plan?",
		color: _constants.colorsHash.grey.hex,
		actions: []
	}];

	var actions = [{
		name: _constants.buttonValues.planCommands.addTasks.name,
		text: "Add Tasks",
		value: _constants.buttonValues.planCommands.addTasks.value,
		type: "button"
	}, {
		name: _constants.buttonValues.planCommands.completeTasks.name,
		text: "Check Off Tasks",
		value: _constants.buttonValues.planCommands.completeTasks.value,
		type: "button"
	}, {
		name: _constants.buttonValues.planCommands.deleteTasks.name,
		text: "Delete Tasks",
		value: _constants.buttonValues.planCommands.deleteTasks.value,
		type: "button"
	}, {
		name: _constants.buttonValues.planCommands.workOnTasks.name,
		text: "Work on Tasks",
		value: _constants.buttonValues.planCommands.workOnTasks.value,
		type: "button"
	}];

	var scope = options.scope;

	actions.forEach(function (action) {
		var value = action.value;

		if (scope == "add" && value == _constants.buttonValues.planCommands.addTasks.value) return;
		if (scope == "complete" && value == _constants.buttonValues.planCommands.completeTasks.value) return;
		if (scope == "delete" && value == _constants.buttonValues.planCommands.deleteTasks.value) return;
		if (scope == "work" && value == _constants.buttonValues.planCommands.workOnTasks.value) return;
		optionsAttachment[0].actions.push(action);
	});

	return optionsAttachment;
}

function getEndOfPlanCommandOptionAttachments() {
	var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];


	var optionsAttachment = [{
		attachment_type: 'default',
		callback_id: "END_OF_PLAN_OPTIONS",
		fallback: "What do you want to do with your plan?",
		color: _constants.colorsHash.grey.hex,
		actions: []
	}];

	var actions = [{
		name: _constants.buttonValues.endOfPlanCommands.addTasks.name,
		text: "Add Tasks",
		value: _constants.buttonValues.endOfPlanCommands.addTasks.value,
		type: "button"
	}, {
		name: _constants.buttonValues.endOfPlanCommands.completeTasks.name,
		text: "Check Off Tasks",
		value: _constants.buttonValues.endOfPlanCommands.completeTasks.value,
		type: "button"
	}, {
		name: _constants.buttonValues.endOfPlanCommands.deleteTasks.name,
		text: "Delete Tasks",
		value: _constants.buttonValues.endOfPlanCommands.deleteTasks.value,
		type: "button"
	}, {
		name: _constants.buttonValues.endOfPlanCommands.workOnTasks.name,
		text: "Work on Tasks",
		value: _constants.buttonValues.endOfPlanCommands.workOnTasks.value,
		type: "button"
	}];

	var scope = options.scope;

	actions.forEach(function (action) {
		var value = action.value;

		if (scope == "add" && value == _constants.buttonValues.endOfPlanCommands.addTasks.value) return;
		if (scope == "complete" && value == _constants.buttonValues.endOfPlanCommands.completeTasks.value) return;
		if (scope == "delete" && value == _constants.buttonValues.endOfPlanCommands.deleteTasks.value) return;
		if (scope == "work" && value == _constants.buttonValues.endOfPlanCommands.workOnTasks.value) return;
		optionsAttachment[0].actions.push(action);
	});

	return optionsAttachment;
}
//# sourceMappingURL=miscHelpers.js.map