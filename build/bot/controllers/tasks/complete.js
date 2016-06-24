'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears(['completed_task'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var channel = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		console.log("\n\n\n\n ~~ in completed task ~~ \n\n\n\n");

		setTimeout(function () {
			// find user then get tasks
			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				// get only live tasks from start day session group
				// start and end SessionGroup will refresh user's "live" tasks
				user.getDailyTasks({
					where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
					include: [_models2.default.Task],
					order: '"DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
					var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

					var name = user.nickName || user.email;
					var SlackUserId = user.SlackUser.SlackUserId;
					var UserId = user.id;

					if (dailyTasks.length == 0) {
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say("Your list is clear! :dancer: Let me know when you're ready to `add a task`");
						});
						return;
					}

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						convo.name = name;
						convo.tasksComplete = {
							completedTasks: []
						};

						console.log("\n\n ~~~ DAILY TASKS IN COMPLETE TASKS ~~ \n\n");
						console.log(dailyTasks);

						dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
						convo.tasksComplete.dailyTasks = dailyTasks;

						convo.ask("Did you want to check off some tasks? :heavy_check_mark:", [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								askWhichTasksToComplete(response, convo);
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								convo.say("Oh, never mind then!");
								convo.next();
							}
						}]);

						// on finish conversation
						convo.on('end', function (convo) {
							var completedTasks = convo.tasksComplete.completedTasks;


							if (convo.status == 'completed') {

								if (completedTasks.length > 0) {

									// put logic here
									completedTasks.forEach(function (dailyTask) {
										console.log("\n\nCompleted Task!:\n\n\n");
										console.log(dailyTask);
										console.log("\n\n\n\n");
										var dataValues = dailyTask.dataValues;

										if (dataValues) {
											var id = dataValues.id;

											_models2.default.DailyTask.find({
												where: { id: id },
												include: [_models2.default.Task]
											}).then(function (dailyTask) {
												var task = dailyTask.Task;
												return task.update({
													done: true
												});
											}).then(function (task) {

												_models2.default.DailyTask.findAll({
													where: ['"Task"."done" = ? AND "DailyTask"."type" = ? AND "DailyTask"."UserId" = ?', false, "live", UserId],
													include: [_models2.default.Task]
												}).then(function (dailyTasks) {
													bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

														dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
														var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

														if (dailyTasks.length == 0) {
															convo.say("You're list is clear :dancer:! Let me know when you're to `add a task`");
														} else {
															convo.say("Here's what your outstanding tasks look like:");
															convo.say(taskListMessage);
														}

														convo.next();
													});
												});
											});
										}
									});
								}
							} else {
								// default premature end
								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
									convo.say("Okay! Exiting now. Let me know when you want to start your day!");
									convo.next();
								});
							}
						});
					});
				});
			});
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ask which tasks to complete


// completed task controller
function askWhichTasksToComplete(response, convo) {
	var dailyTasks = convo.tasksComplete.dailyTasks;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	convo.say("Which task(s) did you get done? Just write which number(s) like `3, 4, 1`");
	convo.ask(taskListMessage, function (response, convo) {

		var initialCompleteTaskNumbers = response.text;
		var dailyTasks = convo.tasksComplete.dailyTasks;

		// either a non-number, or number > length of tasks

		var isInvalid = false;
		var nonNumberTest = new RegExp(/\D/);
		initialCompleteTaskNumbers = initialCompleteTaskNumbers.split(",").map(function (order) {
			order = order.trim();
			var orderNumber = parseInt(order);
			if (nonNumberTest.test(order) || orderNumber > dailyTasks.length) isInvalid = true;
			return orderNumber;
		});

		if (isInvalid) {
			convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:");
		} else {
			convo.say("Great work :punch:");
			var completeTaskNumberList = [];
			initialCompleteTaskNumbers.forEach(function (order) {
				if (order > 0) {
					order--; // 0-index based
					completeTaskNumberList.push(order);
				}
			});

			var completedTaskArray = [];
			completeTaskNumberList.forEach(function (order) {
				completedTaskArray.push(dailyTasks[order]);
			});

			convo.tasksComplete.completedTasks = completedTaskArray;
		}

		convo.next();
	});
}
//# sourceMappingURL=complete.js.map