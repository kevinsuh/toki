'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// programmatic trigger of actual day start flow: `begin_day_flow`
	controller.on('trigger_day_start', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		controller.trigger('begin_day_flow', [bot, { SlackUserId: SlackUserId }]);
	});

	/**
  * 		User directly asks to start day
  * 				~* via Wit *~
  */
	controller.hears(['start_day'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.config = { SlackUserId: SlackUserId };
					var name = user.nickName || user.email;
					convo.say('Hey, ' + name + '! Let\'s make a plan :memo:');
					convo.on('end', function (convo) {
						var SlackUserId = convo.config.SlackUserId;

						controller.trigger('begin_day_flow', [bot, { SlackUserId: SlackUserId }]);
					});
				});
			});
		}, 1000);
	});

	/**
  * 			User confirms he is wanting to
  * 					start his day. confirmation
  * 				needed EVERY time b/c this resets everything
  */

	controller.on('user_confirm_new_day', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.getSessionGroups({
				limit: 5,
				where: ['"SessionGroup"."type" = ?', "start_work"]
			}).then(function (sessionGroups) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					var name = user.nickName || user.email;
					convo.name = name;
					convo.readyToStartDay = false;

					convo.ask('Would you like to start your day?', [{
						pattern: _botResponses.utterances.yes,
						callback: function callback(response, convo) {
							convo.say("Let's do it! :car: :dash:");
							convo.readyToStartDay = true;
							convo.next();
						}
					}, {
						pattern: _botResponses.utterances.no,
						callback: function callback(response, convo) {
							convo.say("Okay. Let me know whenever you're ready to start your day :wave:");
							convo.next();
						}
					}, {
						default: true,
						callback: function callback(response, convo) {
							convo.say("Couldn't quite catch that. Let me know whenever you're ready to `start your day` :wave:");
							convo.next();
						}
					}]);
					convo.on('end', function (convo) {
						if (convo.readyToStartDay) {
							controller.trigger('begin_day_flow', [bot, { SlackUserId: SlackUserId }]);
						} else {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						}
					});
				});
			});
		});
	});

	/**
 * 	~ ACTUAL START OF YOUR DAY ~
 * 		* ask for today's tasks
 * 		* prioritize tasks
 * 		* set time to tasks
 * 		* enter work session flow
 * 		
 */
	controller.on('begin_day_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var name = user.nickName || user.email;
				convo.name = name;

				convo.dayStart = {
					bot: bot,
					taskArray: [],
					UserId: UserId,
					startDayDecision: false, // what does user want to do with day
					prioritizedTaskArray: [] // the final tasks to do for the day
				};

				// live or pending tasks, that are not completed yet
				user.getDailyTasks({
					where: ['"DailyTask"."type" in (?) AND "Task"."done" = ?', ["pending", "live"], false],
					include: [_models2.default.Task]
				}).then(function (dailyTasks) {

					if (dailyTasks.length == 0) {
						// no pending tasks -- it's a new day
						(0, _plan.askForDayTasks)(err, convo);
					} else {
						// has pending tasks
						dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
						convo.dayStart.pendingTasks = dailyTasks;
						(0, _plan.showPendingTasks)(err, convo);
					}
				});

				// on finish conversation
				convo.on('end', function (convo) {

					var responses = convo.extractResponses();
					var dayStart = convo.dayStart;


					console.log('done!');
					console.log("here is day start object:\n\n\n");
					console.log(convo.dayStart);
					console.log("\n\n\n");

					if (convo.status == 'completed') {
						var config;

						(function () {
							var UserId = dayStart.UserId;
							var taskArray = dayStart.taskArray;


							(0, _miscHelpers.closeOldRemindersAndSessions)(user);

							// log `start_work` in SessionGroups
							// and all other relevant DB inserts
							_models2.default.SessionGroup.create({
								type: "start_work",
								UserId: UserId
							}).then(function (sessionGroup) {

								// make all tasks into archived at end of `start_day` flow
								// because you explicitly decided to not work on them anymore
								user.getDailyTasks({
									where: ['"DailyTask"."createdAt" < ? AND "DailyTask"."type" IN (?)', sessionGroup.createdAt, ["pending", "live"]]
								}).then(function (dailyTasks) {
									dailyTasks.forEach(function (dailyTask) {
										dailyTask.update({
											type: "archived"
										});
									});

									// After all of the previous tasks have been put into "pending", choose the select ones and bring them back to "live"
									taskArray.forEach(function (task, index) {
										var dataValues = task.dataValues;

										var priority = index + 1;
										var text = task.text;
										var minutes = task.minutes;


										if (dataValues) {
											// only existing tasks have data values

											// for these, we'll still be making NEW `daily_tasks`, using OLD `tasks`
											var id = dataValues.id;

											_models2.default.DailyTask.find({
												where: { id: id },
												include: [_models2.default.Task]
											}).then(function (dailyTask) {
												var TaskId = dailyTask.TaskId;
												_models2.default.DailyTask.create({
													TaskId: TaskId,
													minutes: minutes,
													priority: priority,
													UserId: UserId
												});
											});
										} else {
											// new task

											_models2.default.Task.create({
												text: text
											}).then(function (task) {
												_models2.default.DailyTask.create({
													TaskId: task.id,
													priority: priority,
													minutes: minutes,
													UserId: UserId
												});
											});
										}
									});
								});

								// cancel all user breaks cause user is RDY TO START DAY
								user.getReminders({
									where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break"]]
								}).then(function (reminders) {
									reminders.forEach(function (reminder) {
										reminder.update({
											"open": false
										});
									});
									// create checkin reminder if requested
									if (dayStart.startDayDecision == _intents2.default.REMINDER) {
										var tenMinuteReminder = (0, _momentTimezone2.default)().add(10, 'minutes');
										var customNote = "Hey! Let me know when you're ready to `start a session` :muscle:";
										_models2.default.Reminder.create({
											remindTime: tenMinuteReminder,
											UserId: UserId,
											customNote: customNote
										});
									}
								});
							});

							// TRIGGER SESSION_START HERE
							config = {
								SlackUserId: SlackUserId,
								controller: controller,
								bot: bot
							};


							(0, _index.triggerIntent)(dayStart.startDayDecision, config);
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						})();
					} else {
						// default premature end
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							convo.say("Okay! Let me know when you want to make a `new plan`");
							convo.next();
						});
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

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _plan = require('../modules/plan');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for start day
//# sourceMappingURL=startDay.js.map