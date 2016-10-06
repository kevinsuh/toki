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
exports.dateStringToMomentTimeZone = dateStringToMomentTimeZone;
exports.getUniqueSlackUsersFromString = getUniqueSlackUsersFromString;
exports.commaSeparateOutStringArray = commaSeparateOutStringArray;
exports.getMostRecentMessageToUpdate = getMostRecentMessageToUpdate;
exports.stringifyNumber = stringifyNumber;
exports.getPingMessageContentAsAttachment = getPingMessageContentAsAttachment;
exports.getGroupedPingMessagesAsAttachment = getGroupedPingMessagesAsAttachment;
exports.whichGroupedPingsToCancelAsAttachment = whichGroupedPingsToCancelAsAttachment;
exports.getHandleQueuedPingActions = getHandleQueuedPingActions;
exports.getStartSessionOptionsAttachment = getStartSessionOptionsAttachment;
exports.convertNumberStringToArray = convertNumberStringToArray;
exports.getSessionContentFromMessageObject = getSessionContentFromMessageObject;

var _constants = require('./constants');

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

function getRandomExample(type) {
	var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


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
	var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
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
 * get array of slackUserIds from string
 * @param  {string input} string "ping <@UIXUXUXU>" // done automatically
 * @return {array of SlackUserIds} ['UIXUXUXU'];
 */
function getUniqueSlackUsersFromString(string) {
	var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	var normalSlackNames = config.normalSlackNames;
	// by default will get translated into SlackUserId

	var slackUserIdContainer = normalSlackNames ? new RegExp(/@(\S*)/g) : new RegExp(/<@(.*?)>/g);
	var replaceRegEx = new RegExp(/<|>|@/g);

	var arrayString = string.match(slackUserIdContainer);
	var slackUserIds = [];

	if (arrayString) {
		arrayString.forEach(function (string) {
			var slackUserId = string.replace(replaceRegEx, "");
			if (!_lodash2.default.includes(slackUserIds, slackUserId)) {
				slackUserIds.push(slackUserId);
			}
		});
		if (slackUserIds.length == 0) {
			return false;
		} else {
			return slackUserIds;
		}
	} else {
		return false;
	}
}

// returns array joined together into a string
function commaSeparateOutStringArray(a) {
	var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	var codeBlock = config.codeBlock;
	var slackNames = config.slackNames;
	var SlackUserIds = config.SlackUserIds;


	a = a.map(function (a) {
		if (codeBlock) {
			a = '`' + a + '`';
		} else if (slackNames) {
			a = '@' + a;
		} else if (SlackUserIds) {
			a = '<@' + a + '>';
		}
		return a;
	});

	// make into string
	var string = [a.slice(0, -1).join(', '), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and ');
	return string;
}

// this is for deleting the most recent message!
// mainly used for convo.ask, when you do natural language instead
// of clicking the button
function getMostRecentMessageToUpdate(userChannel, bot) {
	var callbackId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	var sentMessages = bot.sentMessages;


	var updateTaskListMessageObject = false;
	if (sentMessages && sentMessages[userChannel]) {

		var channelSentMessages = sentMessages[userChannel];

		// loop backwards to find the most recent message that matches
		// this convo ChannelId w/ the bot's sentMessage ChannelId
		for (var i = channelSentMessages.length - 1; i >= 0; i--) {
			var _channelSentMessages$ = channelSentMessages[i];
			var channel = _channelSentMessages$.channel;
			var ts = _channelSentMessages$.ts;
			var attachments = _channelSentMessages$.attachments;


			if (channel == userChannel) {
				if (callbackId && attachments && callbackId == attachments[0].callback_id) {
					updateTaskListMessageObject = {
						channel: channel,
						ts: ts
					};
					break;
				} else {
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

function stringifyNumber(n) {
	if (n < 20) return _constants.specialNumbers[n];
	if (n % 10 === 0) return _constants.decaNumbers[Math.floor(n / 10) - 2] + 'ieth';
	return deca[Math.floor(n / 10) - 2] + 'y-' + _constants.specialNumbers[n % 10];
}

function getPingMessageContentAsAttachment(ping) {

	var pingMessagesContent = '';

	ping.dataValues.PingMessages.forEach(function (pingMessage) {
		var pingMessageContent = pingMessage.dataValues.content;
		pingMessagesContent = pingMessagesContent + '\n' + pingMessageContent;
	});

	var attachments = [{
		attachment_type: 'default',
		fallback: 'Let\'s start this conversation!',
		mrkdwn_in: ["text"],
		callback_id: "PING_MESSAGE",
		color: _constants.colorsHash.toki_purple.hex,
		text: pingMessagesContent
	}];
	return attachments;
}

// this is for more than one ping
function getGroupedPingMessagesAsAttachment(pings) {

	var groupedPingMessagesAttachment = [];

	pings.forEach(function (ping, index) {

		var numberString = stringifyNumber(index + 1);

		var pingMessagesContent = '';

		ping.dataValues.PingMessages.forEach(function (pingMessage) {
			var pingMessageContent = pingMessage.dataValues.content;
			pingMessagesContent = pingMessagesContent + '\n' + pingMessageContent;
		});

		groupedPingMessagesAttachment.push({
			attachment_type: 'default',
			fallback: 'Here is the ' + numberString + ' ping!',
			pretext: '*Here is the ' + numberString + ' ping:*',
			mrkdwn_in: ["text", "pretext"],
			callback_id: "PING_MESSAGE",
			color: _constants.colorsHash.toki_purple.hex,
			text: pingMessagesContent
		});
	});

	return groupedPingMessagesAttachment;
}

// this is for more than one ping
// pings must have sessino attached to it!
function whichGroupedPingsToCancelAsAttachment(pings) {

	var groupedPingMessagesAttachment = [];

	pings.forEach(function (ping, index) {
		var _ping$dataValues = ping.dataValues;
		var ToUser = _ping$dataValues.ToUser;
		var session = _ping$dataValues.session;

		var endTimeObject = (0, _momentTimezone2.default)(session.dataValues.endTime);
		var endTimeString = endTimeObject.format("h:mma");

		var numberString = stringifyNumber(index + 1);
		var count = index + 1;

		var pingMessagesContent = '';

		ping.dataValues.PingMessages.forEach(function (pingMessage) {
			var pingMessageContent = pingMessage.dataValues.content;
			pingMessagesContent = pingMessagesContent + '\n' + pingMessageContent;
		});

		groupedPingMessagesAttachment.push({
			attachment_type: 'default',
			fallback: count + ') Ping to <@' + ToUser.dataValues.SlackUserId + '> at ' + endTimeString + ' or sooner:',
			pretext: count + ') Ping to <@' + ToUser.dataValues.SlackUserId + '> at ' + endTimeString + ' or sooner:',
			mrkdwn_in: ["text", "pretext"],
			callback_id: "PING_MESSAGE",
			color: _constants.colorsHash.toki_purple.hex,
			text: pingMessagesContent
		});
	});

	return groupedPingMessagesAttachment;
}

function getHandleQueuedPingActions(ping) {

	var actions = [];

	if (ping && ping.dataValues) {
		actions = [{
			name: _constants.buttonValues.sendNow.name,
			text: "Send now :bomb:",
			value: '{"updatePing": true, "sendBomb": true, "PingId": "' + ping.dataValues.id + '"}',
			type: "button"
		}, {
			name: _constants.buttonValues.cancelPing.name,
			text: "Cancel ping :negative_squared_cross_mark:",
			value: '{"updatePing": true, "cancelPing": true, "PingId": "' + ping.dataValues.id + '"}',
			type: "button"
		}];
	}

	return actions;
}

// include ping actions if > 0 pings
function getStartSessionOptionsAttachment(pings) {
	var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	var customOrder = config.customOrder;
	var order = config.order;

	var attachments = [];

	var deferredPingsText = pings.length == 1 ? "Defer Ping :arrow_right:" : "Defer Pings :arrow_right:";
	var cancelPingsText = pings.length == 1 ? "Cancel Ping :negative_squared_cross_mark:" : "Cancel Ping(s) :negative_squared_cross_mark:";

	if (customOrder && order) {

		attachments = [{
			attachment_type: 'default',
			callback_id: "LIVE_SESSION_OPTIONS",
			fallback: "Good luck with your session!",
			actions: []
		}];

		order.forEach(function (order) {

			switch (order) {
				case 'changeTimeAndTask':
					attachments[0].actions.push({
						name: _constants.buttonValues.changeTimeAndTask.name,
						text: "Change Time + Task",
						value: _constants.buttonValues.changeTimeAndTask.value,
						type: "button"
					});
					break;
				case 'deferPing':
					attachments[0].actions.push({
						name: _constants.buttonValues.deferPing.name,
						text: deferredPingsText,
						value: _constants.buttonValues.deferPing.value,
						type: "button"
					});
					break;
				case 'cancelPing':
					attachments[0].actions.push({
						name: _constants.buttonValues.cancelPing.name,
						text: cancelPingsText,
						value: _constants.buttonValues.cancelPing.value,
						type: "button"
					});
					break;
				case 'endSession':
					attachments[0].actions.push({
						name: _constants.buttonValues.endSession.name,
						text: "End Session",
						value: _constants.buttonValues.endSession.value,
						type: "button"
					});
					break;
				case 'sendSooner':
					attachments[0].actions.push({
						name: _constants.buttonValues.sendSooner.name,
						text: "Send Sooner",
						value: _constants.buttonValues.sendSooner.value,
						type: "button"
					});
				default:
					break;
			}
		});

		return attachments;
	} else {
		attachments = [{
			attachment_type: 'default',
			callback_id: "LIVE_SESSION_OPTIONS",
			fallback: "Good luck with your session!",
			actions: [{
				name: _constants.buttonValues.changeTimeAndTask.name,
				text: "Change Time + Task",
				value: _constants.buttonValues.changeTimeAndTask.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endSession.name,
				text: "End Session",
				value: _constants.buttonValues.endSession.value,
				type: "button"
			}]
		}];

		if (pings.length > 0) {

			var pingActions = [{
				name: _constants.buttonValues.deferPing.name,
				text: deferredPingsText,
				value: _constants.buttonValues.deferPing.value,
				type: "button"
			}, {
				name: _constants.buttonValues.cancelPing.name,
				text: cancelPingsText,
				value: _constants.buttonValues.cancelPing.value,
				type: "button"
			}];

			var fullActionsArray = _lodash2.default.concat(pingActions, attachments[0].actions);
			attachments[0].actions = fullActionsArray;
		}
	}

	return attachments;
}

/**
 * takes in user input for tasks done `4, 1, 3` and converts it to an array of the numbers
 * @param  {string} taskCompletedString `4, 1, 3` (only uniques!)
 * @param {int} maxNumber if number is higher than this it is invalid!
 * @return {[integer]}                     [4, 1, 3] * if valid *
 */
function convertNumberStringToArray(numbersString, maxNumber) {

	var splitter = RegExp(/(,|\ba[and]{1,}\b|\bthen\b)/);
	var numbersSplitArray = numbersString.split(splitter);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx = new RegExp(/[\d]+/);
	var validNumberArray = [];

	numbersSplitArray.forEach(function (numberString) {

		var number = numberString.match(numberRegEx);

		// if it's a valid number and within the remainingTasks length
		if (number && number <= maxNumber) {
			number = parseInt(number[0]);
			if (!_lodash2.default.includes(validNumberArray, number)) {
				validNumberArray.push(number);
			}
		}
	});

	if (validNumberArray.length == 0) {
		return false;
	} else {
		return validNumberArray;
	}
}

// get the session content from message object
// if DateTime, it will get the reminder unless the 2nd or 3rd to last word is "until" or "to"
// if Duration, it will get the reminder unless the 2nd or 3rd to last word is "for"
// if no DateTime or Duration, will just get the message text
// if it has Duration || DateTime and no reminder, then content will be false
function getSessionContentFromMessageObject(message) {
	var text = message.text;
	var _message$intentObject = message.intentObject.entities;
	var intent = _message$intentObject.intent;
	var reminder = _message$intentObject.reminder;
	var duration = _message$intentObject.duration;
	var datetime = _message$intentObject.datetime;


	var textArray = text.split(" ");
	var content = false;

	if (duration) {

		if (_lodash2.default.nth(textArray, -2) == "for") {

			textArray = textArray.slice(0, -2);
			content = textArray.join(" ");
		} else if (_lodash2.default.nth(textArray, -3) == "for") {

			textArray = textArray.slice(0, -3);
			content = textArray.join(" ");
		} else if (reminder) {

			content = reminder[0].value;
		}
	} else if (datetime) {

		if (_lodash2.default.nth(textArray, -2) == "until" || _lodash2.default.nth(textArray, -2) == "to") {

			textArray = textArray.slice(0, -2);
			content = textArray.join(" ");
		} else if (_lodash2.default.nth(textArray, -3) == "until" || _lodash2.default.nth(textArray, -3) == "to") {

			textArray = textArray.slice(0, -3);
			content = textArray.join(" ");
		} else if (reminder) {

			content = reminder[0].value;
		}
	} else {
		// if no duration or datetime, we should just use entire text
		content = text;
	}

	return content;
}
//# sourceMappingURL=messageHelpers.js.map