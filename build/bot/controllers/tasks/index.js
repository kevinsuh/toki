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
						(0, _miscHelpers.prioritizeDailyTasks)(user);
						(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						console.log("\n\n ~ view tasks finished ~ \n\n");
					});
				});
			});
		});
	});

	controller.on('edit_tasks_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var taskNumbers = config.taskNumbers;
		var taskDecision = config.taskDecision;
		var message = config.message;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;


			user.getWorkSessions({
				where: ['"open" = ?', true]
			}).then(function (workSessions) {

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
							tz: tz,
							SlackUserId: SlackUserId,
							UserId: UserId,
							dailyTasks: dailyTasks,
							updateTaskListMessageObject: {},
							newTasks: [],
							dailyTaskIdsToDelete: [],
							dailyTaskIdsToComplete: [],
							dailyTasksToUpdate: [], // existing dailyTasks
							openWorkSession: openWorkSession,
							taskDecision: taskDecision,
							taskNumbers: taskNumbers
						};

						// this is the flow you expect for editing tasks
						(0, _editTaskListFunctions.startEditTaskListMessage)(convo);

						convo.on('end', function (convo) {
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

							if (startSession && dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {
								var config = {
									SlackUserId: SlackUserId,
									dailyTasksToWorkOn: dailyTasksToWorkOn
								};
								config.intent = _intents2.default.START_SESSION;
								controller.trigger('new_session_group_decision', [bot, config]);
								return;
							}

							setTimeout(function () {

								setTimeout(function () {
									(0, _miscHelpers.prioritizeDailyTasks)(user);
								}, 1000);

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

	controller.hears(['daily_tasks', 'add_daily_task', 'completed_task'], 'direct_message', _index.wit.hears, function (bot, message) {
		var text = message.text;
		var channel = message.channel;

		var SlackUserId = message.user;

		// wit may pick up "add check in" as add_daily_task
		if (_botResponses.utterances.startsWithAdd.test(text) && _botResponses.utterances.containsCheckin.test(text)) {
			var _config = { SlackUserId: SlackUserId, message: message };
			if (_botResponses.utterances.containsOnlyCheckin.test(text)) {
				_config.reminder_type = "work_session";
			}
			controller.trigger('ask_for_reminder', [bot, _config]);
			return;
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});

		var config = { SlackUserId: SlackUserId, message: message };

		var taskNumbers = (0, _messageHelpers.convertStringToNumbersArray)(text);
		if (taskNumbers) {
			config.taskNumbers = taskNumbers;
		}

		// this is how you make switch/case statements with RegEx
		switch (text) {
			case (text.match(_constants.TASK_DECISION.complete.reg_exp) || {}).input:
				console.log('\n\n ~~ User wants to complete task ~~ \n\n');
				config.taskDecision = _constants.TASK_DECISION.complete.word;
				break;
			case (text.match(_constants.TASK_DECISION.add.reg_exp) || {}).input:
				console.log('\n\n ~~ User wants to add task ~~ \n\n');
				config.taskDecision = _constants.TASK_DECISION.add.word;
				break;
			case (text.match(_constants.TASK_DECISION.view.reg_exp) || {}).input:
				console.log('\n\n ~~ User wants to view task ~~ \n\n');
				config.taskDecision = _constants.TASK_DECISION.view.word;
				break;
			case (text.match(_constants.TASK_DECISION.delete.reg_exp) || {}).input:
				console.log('\n\n ~~ User wants to delete task ~~ \n\n');
				config.taskDecision = _constants.TASK_DECISION.delete.word;
				break;
			case (text.match(_constants.TASK_DECISION.edit.reg_exp) || {}).input:
				console.log('\n\n ~~ User wants to edit task ~~ \n\n');
				config.taskDecision = _constants.TASK_DECISION.edit.word;
				break;
			case (text.match(_constants.TASK_DECISION.work.reg_exp) || {}).input:
				console.log('\n\n ~~ User wants to work on task ~~ \n\n');
				config.taskDecision = _constants.TASK_DECISION.work.word;
				break;
			default:
				config.taskDecision = _constants.TASK_DECISION.view.word;
				break;
		}

		console.log('\n\nCONFIG:');
		console.log(config);

		setTimeout(function () {
			controller.trigger('edit_tasks_flow', [bot, config]);
		}, 1000);
	});

	/**
  * 		UNDO COMPLETE OR DELETE OF TASKS
  */
	controller.on('undo_task_complete', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;
		var payload = config.payload;


		var dailyTaskIdsToUnComplete = [];
		if (payload.actions[0]) {
			var dailyTaskIdsString = payload.actions[0].name;
			dailyTaskIdsToUnComplete = dailyTaskIdsString.split(",");
		}

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;


			user.getDailyTasks({
				where: ['"DailyTask"."id" IN (?)', dailyTaskIdsToUnComplete],
				include: [_models2.default.Task]
			}).then(function (dailyTasks) {

				var count = 0;
				dailyTasks.forEach(function (dailyTask) {
					dailyTask.dataValues.Task.update({
						done: false
					});
					count++;
					if (count == dailyTasks.length) {
						setTimeout(function () {
							(0, _miscHelpers.prioritizeDailyTasks)(user);
						}, 750);
					}
				});

				var dailyTaskTexts = dailyTasks.map(function (dailyTask) {
					var text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
					return text;
				});
				var dailyTasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts);

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					if (dailyTaskTexts.length == 1) {
						convo.say('Okay! I unchecked ' + dailyTasksString + '. Good luck with that task!');
					} else {
						convo.say('Okay! I unchecked ' + dailyTasksString + '. Good luck with those tasks!');
					}
				});
			});
		});
	});

	/**
  * 		UNDO COMPLETE OR DELETE OF TASKS
  */
	controller.on('undo_task_delete', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;
		var payload = config.payload;


		var dailyTaskIdsToUnDelete = [];
		if (payload.actions[0]) {
			var dailyTaskIdsString = payload.actions[0].name;
			dailyTaskIdsToUnDelete = dailyTaskIdsString.split(",");
		}

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;


			user.getDailyTasks({
				where: ['"DailyTask"."id" IN (?)', dailyTaskIdsToUnDelete],
				include: [_models2.default.Task]
			}).then(function (dailyTasks) {

				var count = 0;
				dailyTasks.forEach(function (dailyTask) {
					dailyTask.update({
						type: "live"
					});
					count++;
					if (count == dailyTasks.length) {
						setTimeout(function () {
							(0, _miscHelpers.prioritizeDailyTasks)(user);
						}, 750);
					}
				});

				var dailyTaskTexts = dailyTasks.map(function (dailyTask) {
					var text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
					return text;
				});
				var dailyTasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts);

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					if (dailyTaskTexts.length == 1) {
						convo.say('Okay! I undeleted ' + dailyTasksString + '. Good luck with that task!');
					} else {
						convo.say('Okay! I undeleted ' + dailyTasksString + '. Good luck with those tasks!');
					}
				});
			});
		});
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

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _add = require('./add');

var _add2 = _interopRequireDefault(_add);

var _complete = require('./complete');

var _complete2 = _interopRequireDefault(_complete);

var _work_sessions = require('../work_sessions');

var _editTaskListFunctions = require('./editTaskListFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for tasks
//# sourceMappingURL=index.js.map