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
				order: '"Task"."done", "DailyTask"."priority" ASC'
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
						(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
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

			user.getWorkSessions({
				where: ['"open" = ?', true]
			}).then(function (workSessions) {

				console.log("\n\n\nadding work session...\n\n");
				var openWorkSession = false;
				if (workSessions.length > 0) {
					var now = (0, _moment2.default)();
					var endTime = (0, _moment2.default)(workSessions[0].endTime).add(1, 'minutes');
					if (endTime > now) {
						openWorkSession = workSessions[0];
					}
				}

				user.getDailyTasks({
					where: ['"DailyTask"."type" = ?', "live"],
					include: [_models2.default.Task],
					order: '"Task"."done", "DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");

						convo.tasksEdit = {
							bot: bot,
							SlackUserId: SlackUserId,
							dailyTasks: dailyTasks,
							updateTaskListMessageObject: {},
							newTasks: [],
							dailyTaskIdsToDelete: [],
							dailyTaskIdsToComplete: [],
							dailyTasksToUpdate: [], // existing dailyTasks
							openWorkSession: openWorkSession
						};

						// this is the flow you expect for editing tasks
						(0, _editTaskListFunctions.startEditTaskListMessage)(convo);

						convo.on('end', function (convo) {
							console.log("\n\n ~ edit tasks finished ~ \n\n");
							console.log(convo.tasksEdit);

							var _convo$tasksEdit = convo.tasksEdit;
							var newTasks = _convo$tasksEdit.newTasks;
							var dailyTasks = _convo$tasksEdit.dailyTasks;
							var SlackUserId = _convo$tasksEdit.SlackUserId;
							var dailyTaskIdsToDelete = _convo$tasksEdit.dailyTaskIdsToDelete;
							var dailyTaskIdsToComplete = _convo$tasksEdit.dailyTaskIdsToComplete;
							var dailyTasksToUpdate = _convo$tasksEdit.dailyTasksToUpdate;
							var startSession = _convo$tasksEdit.startSession;
							var dailyTasksToWorkOn = _convo$tasksEdit.dailyTasksToWorkOn;


							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });

							if (startSession && dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {
								var config = {
									SlackUserId: SlackUserId,
									dailyTasksToWorkOn: dailyTasksToWorkOn
								};
								config.intent = _intents2.default.START_SESSION;
								controller.trigger('new_session_group_decision', [bot, config]);
								return;
							}

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

							// delete tasks if requested
							if (dailyTaskIdsToDelete.length > 0) {
								_models2.default.DailyTask.update({
									type: "deleted"
								}, {
									where: ['"DailyTasks"."id" in (?)', dailyTaskIdsToDelete]
								});
							}

							// complete tasks if requested
							if (dailyTaskIdsToComplete.length > 0) {
								_models2.default.DailyTask.findAll({
									where: ['"DailyTask"."id" in (?)', dailyTaskIdsToComplete],
									include: [_models2.default.Task]
								}).then(function (dailyTasks) {

									var completedTaskIds = dailyTasks.map(function (dailyTask) {
										return dailyTask.TaskId;
									});

									_models2.default.Task.update({
										done: true
									}, {
										where: ['"Tasks"."id" in (?)', completedTaskIds]
									});
								});
							}

							// update daily tasks if requested
							if (dailyTasksToUpdate.length > 0) {
								dailyTasksToUpdate.forEach(function (dailyTask) {
									if (dailyTask.dataValues && dailyTask.minutes && dailyTask.text) {
										var minutes = dailyTask.minutes;
										var text = dailyTask.text;

										_models2.default.DailyTask.update({
											text: text,
											minutes: minutes
										}, {
											where: ['"DailyTasks"."id" = ?', dailyTask.dataValues.id]
										});
									}
								});
							}

							setTimeout(function () {
								// only check for live tasks if SOME action took place
								if (newTasks.length > 0 || dailyTaskIdsToDelete.length > 0 || dailyTaskIdsToComplete.length > 0 || dailyTasksToUpdate.length > 0) {
									(0, _work_sessions.checkWorkSessionForLiveTasks)({ SlackUserId: SlackUserId, bot: bot, controller: controller });
								}
							}, 750);
						});
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

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _add = require('./add');

var _add2 = _interopRequireDefault(_add);

var _complete = require('./complete');

var _complete2 = _interopRequireDefault(_complete);

var _work_sessions = require('../work_sessions');

var _editTaskListFunctions = require('./editTaskListFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;
//# sourceMappingURL=index.js.map