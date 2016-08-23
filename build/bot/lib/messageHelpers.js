'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getRandomExample = getRandomExample;
exports.witTimeResponseToTimeZoneObject = witTimeResponseToTimeZoneObject;
exports.witDurationToTimeZoneObject = witDurationToTimeZoneObject;
exports.witDurationToMinutes = witDurationToMinutes;
exports.convertMinutesToHoursString = convertMinutesToHoursString;
exports.convertTimeStringToMinutes = convertTimeStringToMinutes;

var _constants = require('./constants');

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

getRandomExample("session");

/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

function getRandomExample(type) {
	var config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];


	var example = false;
	switch (type) {
		case "session":
			example = _constants.startSessionExamples[Math.floor(Math.random() * _constants.startSessionExamples.length)];
			break;
		case "approvalWord":
			example = _constants.approvalWords[Math.floor(Math.random() * _constants.approvalWords.length)];
			break;
		default:
			break;
	}

	if (config.upperCase) {
		example = capitalizeFirstLetter(example);
	}

	return example;
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * take in time response object and convert it to remindTimeStamp moment obj
 * @param  {obj} response response object
 * @return {moment-tz object}
 */
function witTimeResponseToTimeZoneObject(response, tz) {

	console.log("\n\n response obj in witTimeResponseToTimeZoneObject \n\n");

	var text = response.text;
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
			if (_constants.constants.DURATION_INTENT.reg_exp.test(response.text) && !_constants.constants.TIME_INTENT.reg_exp.test(response.text)) {

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
//# sourceMappingURL=messageHelpers.js.map