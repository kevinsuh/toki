'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEndPlanConversation = startEndPlanConversation;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// this one shows the task list message and asks for options
function startEndPlanConversation(convo) {
	var _convo$dayEnd = convo.dayEnd;
	var wonDay = _convo$dayEnd.wonDay;
	var wonDayStreak = _convo$dayEnd.wonDayStreak;
	var dailyTasks = convo.dayEnd.dailyTasks;


	var completedDailyTasks = [];
	var minutesWorked = 0;
	dailyTasks.forEach(function (dailyTask) {
		if (dailyTask.Task.done) {
			completedDailyTasks.push(dailyTask);
		}
		minutesWorked += dailyTask.dataValues.minutesSpent;
	});

	var timeWorkedString = (0, _messageHelpers.convertMinutesToHoursString)(minutesWorked);

	var options = { reviewVersion: true, calculateMinutes: true, noTitles: true };
	var completedTaskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	if (wonDay) {
		convo.say(':trophy: *Congratulations on winning the day!* :trophy:');
		convo.say('It\'s all about time well spent, and today you did just that');
		if (completedDailyTasks.length > 0) {
			convo.say('Here\'s what you got done:\n' + completedTaskListMessage);
		}

		if (wonDayStreak > 1) {
			convo.say('*You’ve won the day ​2 days in a row* :fire:');
		}
	} else {
		var message = 'We can do this together the next time!';
		if (minutesWorked > 0) {
			message = message + ' You still spent *' + timeWorkedString + '* working toward your top priorities';
		}
		convo.say(message);
	}

	askForReflection(convo);
}

function askForReflection(convo) {
	var _convo$dayEnd2 = convo.dayEnd;
	var wantsPing = _convo$dayEnd2.wantsPing;
	var pingTime = _convo$dayEnd2.pingTime;
	var wonDay = _convo$dayEnd2.wonDay;
	var nickName = _convo$dayEnd2.nickName;


	var message = '';
	if (wonDay) {
		message = 'What was the biggest factor that helped you focus on your most important priorities?';
	} else {
		message = 'What was the biggest factor that prevented you from focusing on your most important priorities?';
	}

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "END_PLAN_REFLECT",
			fallback: "Do you want to reflect about today?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.notToday.value,
				text: "Not today :grin:",
				value: _constants.buttonValues.notToday.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.notToday,
		callback: function callback(response, convo) {

			convo.say('Got it!');

			if (wantsPing && !pingTime) {
				askForPingTime(convo);
			} else {
				convo.say('I hope you have a great rest of the day and I’ll see you soon!');
			}

			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			convo.say('Thank you for sharing!');
			convo.dayEnd.reflection = response.text;

			if (wantsPing && !pingTime) {
				askForPingTime(convo);
			} else {
				convo.say('I hope you have a great rest of the day and I’ll see you soon!');
			}

			convo.next();
		}
	}]);
}

function askForPingTime(convo) {
	var _convo$dayEnd3 = convo.dayEnd;
	var tz = _convo$dayEnd3.tz;
	var wantsPing = _convo$dayEnd3.wantsPing;
	var pingTime = _convo$dayEnd3.pingTime;
	var wonDay = _convo$dayEnd3.wonDay;
	var nickName = _convo$dayEnd3.nickName;


	var text = '';
	if (wonDay) {
		text = 'To help you keep winning your days like today, I can proactively reach out in the morning to help you plan your day. *What time would you like me to check in* with you each weekday morning?';
	} else {
		text = 'To give you a better shot to win the day as soon as possible, I can proactively reach out in the morning to help you plan your day. *What time would you like me to check in* with you each weekday morning?';
	}

	var attachments = [{
		attachment_type: 'default',
		callback_id: "PING_USER",
		fallback: "Do you want me to ping you in the morning?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.no.name,
			text: "No thanks",
			value: _constants.buttonValues.no.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {

			convo.dayEnd.wantsPing = false;
			convo.say('If you want me to reach out, just say `show settings` and set the time for your morning check-in. I hope you have a great rest of the day and I’ll see you soon!');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;
			var _response$intentObjec = response.intentObject.entities;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			var now = (0, _moment2.default)();

			if (!customTimeObject && !datetime) {

				convo.say("Sorry, I didn't get that :thinking_face: let me know a time like `8:30am`");
				convo.repeat();
			} else {

				// datetime success!
				convo.dayEnd.pingTime = customTimeObject;
				var timeString = customTimeObject.format("h:mm a");
				convo.say('Great! I’ll reach out weekdays at ' + timeString + '. You can always change this by saying `show settings`');
				convo.say('I hope you have a great rest of the day and I’ll see you soon!');
			}

			convo.next();
		}
	}]);
}
//# sourceMappingURL=endPlanFunctions.js.map