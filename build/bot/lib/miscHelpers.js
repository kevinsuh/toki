'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.createMomentObjectWithSpecificTimeZone = createMomentObjectWithSpecificTimeZone;
exports.dateStringToMomentTimeZone = dateStringToMomentTimeZone;
exports.witTimeResponseToTimeZoneObject = witTimeResponseToTimeZoneObject;

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
	var custom_time = entities.custom_time;


	var now = (0, _momentTimezone2.default)();
	var remindTimeStamp;
	if (!custom_time && !duration) {
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
			if (custom_time) {

				remindTimeStamp = custom_time[0].value; // 2016-06-24T16:24:00.000-04:00

				// handle if it is a duration configured intent
				if (_constants.DURATION_INTENT.reg_exp.test(response.text) && !_constants.TIME_INTENT.reg_exp.test(response.text)) {

					console.log("\n\n ~~ interpreted custom_time as duration ~~ \n");
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
//# sourceMappingURL=miscHelpers.js.map