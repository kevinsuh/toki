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
	var wonDay = convo.dayEnd.wonDay;
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
		convo.say('Here\'s what you got done:\n' + completedTaskListMessage);
	} else {
		convo.say('We can do this together the next time! You still spent *' + minutesWorked + '* working toward your top priorities');
	}

	askForReflection(convo);
}

function askForReflection(convo) {
	var _convo$dayEnd = convo.dayEnd;
	var wonDay = _convo$dayEnd.wonDay;
	var nickName = _convo$dayEnd.nickName;


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
				name: _constants.buttonValues.notShare.value,
				text: "Not sharing today :grin:",
				value: _constants.buttonValues.notShare.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.notShare,
		callback: function callback(response, convo) {
			convo.say('Got it!');
			convo.say('I hope you have a great rest of the day and I’ll see you soon!');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			convo.say('Thank you for sharing!');
			convo.say('You said: ' + response.text);
			convo.say('I hope you have a great rest of the day and I’ll see you soon!');
			convo.next();
		}
	}]);
}
//# sourceMappingURL=endPlanFunctions.js.map