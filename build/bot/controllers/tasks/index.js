'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	(0, _add2.default)(controller);
	(0, _complete2.default)(controller);

	/**
  * 		YOUR DAILY TASKS
  */

	controller.on('view_daily_tasks_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.getDailyTasks({
				where: ['"DailyTask"."type" = ?', "live"],
				include: [_models2.default.Task],
				order: '"DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
					var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

					if (dailyTasks.length == 0) {
						convo.say("Looks like you don't have any tasks for today!");
						convo.say("Let me know if you want to `start your day` or `add tasks` to an existing day :memo:");
					} else {
						convo.say("Here are your tasks for today :memo::");
						convo.say(taskListMessage);
					}
					convo.on('end', function (convo) {
						console.log("\n\n ~ view tasks finished ~ \n\n");
					});
				});
			});
		});
	});

	controller.hears(['daily_tasks'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var channel = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {
			controller.trigger('view_daily_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
		}, 1000);
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _add = require('./add');

var _add2 = _interopRequireDefault(_add);

var _complete = require('./complete');

var _complete2 = _interopRequireDefault(_complete);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for tasks
//# sourceMappingURL=index.js.map