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


	if (wonDay) {
		startWonDayConversation(convo);
	} else {
		startDidNotWinDayConversation(convo);
	}
}

// user has won the day!
function startWonDayConversation(convo) {
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

	convo.say('Congratulations on winning the day! It’s all about time well spent, and today you did just that :trophy:');
	convo.say(completedTaskListMessage);
}

// user has not won the day!
function startDidNotWinDayConversation(convo) {}
//# sourceMappingURL=endPlanFunctions.js.map