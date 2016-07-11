'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// base controller for tasks


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

	controller.on('edit_tasks_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;

			user.getDailyTasks({
				where: ['"DailyTask"."type" = ?', "live"],
				include: [_models2.default.Task],
				order: '"DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");

					convo.tasksEdit = {
						bot: bot,
						SlackUserId: SlackUserId,
						dailyTasks: dailyTasks,
						updateTaskListMessageObject: {},
						newTasks: []
					};

					if (dailyTasks.length == 0) {
						convo.say("Looks like you don't have any tasks for today!");
						convo.say("Let me know if you want to `start your day` or `add tasks` to an existing day :memo:");
					} else {
						// this is the flow you expect for editing tasks
						(0, _editTaskListFunctions.startEditTaskListMessage)(convo);
					}
					convo.on('end', function (convo) {
						console.log("\n\n ~ edit tasks finished ~ \n\n");
						console.log(convo.tasksEdit);

						var _convo$tasksEdit = convo.tasksEdit;
						var newTasks = _convo$tasksEdit.newTasks;
						var dailyTasks = _convo$tasksEdit.dailyTasks;
						var SlackUserId = _convo$tasksEdit.SlackUserId;

						// add new tasks if they got added

						if (newTasks.length > 0) {
							var priority = dailyTasks.length;
							// add the priorities
							newTasks = newTasks.map(function (newTask) {
								priority++;
								return _extends({}, newTask, {
									priority: priority
								});
							});

							newTasks.forEach(function (newTask) {
								var minutes = newTask.minutes;
								var text = newTask.text;
								var priority = newTask.priority;

								if (minutes && text) {
									_models2.default.Task.create({
										text: text
									}).then(function (task) {
										var TaskId = task.id;
										_models2.default.DailyTask.create({
											TaskId: TaskId,
											priority: priority,
											minutes: minutes,
											UserId: UserId
										});
									});
								}
							});
						}
					});
				});
			});
		});
	});

	controller.hears(['daily_tasks', 'completed_task'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var channel = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {
			controller.trigger('edit_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
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

var _editTaskListFunctions = require('./editTaskListFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;
//# sourceMappingURL=index.js.map