'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEditTaskListMessage = startEditTaskListMessage;

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

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// this one shows the task list message and asks for options
function startEditTaskListMessage(convo) {
	var dailyTasks = convo.tasksEdit.dailyTasks;


	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	convo.say("Here are your tasks for today :memo::");
	convo.say(taskListMessage);
	convo.next();
}
//# sourceMappingURL=editTaskListFunctions.js.map