'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		/**
   * 			check if user has open session (should only be one)
   * 					if yes, trigger finish and end_session flow
   * 			  	if no, reply with confusion & other options
   */

		var SlackUserId = message.user;
		var doneSessionEarly = true;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {
			if (_botResponses.utterances.containsTaskOrPriority.test(message.text)) {
				// want to finish off some tasks
				controller.trigger('edit_plan_flow', [bot, { SlackUserId: SlackUserId }]);
			} else {
				controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId, doneSessionEarly: doneSessionEarly }]);
			}
		}, 800);
	});

	/**
  * 		User has confirmed to ending session
  * 		This will immediately close the session, then move to
  * 		specified "post session" options
  */
	controller.on('done_session_flow', function (bot, config) {

		// you can pass in a storedWorkSession
		var SlackUserId = config.SlackUserId;
		var storedWorkSession = config.storedWorkSession;
		var sessionTimerUp = config.sessionTimerUp;
		var doneSessionEarly = config.doneSessionEarly;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var tz = user.SlackUser.tz;
			var defaultBreakTime = user.defaultBreakTime;
			var defaultSnoozeTime = user.defaultSnoozeTime;

			var UserId = user.id;

			user.getWorkSessions({
				where: ['"open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				include: [_models2.default.DailyTask]
			}).then(function (workSessions) {

				var workSession = storedWorkSession || workSessions[0];

				if (workSession) {

					// only update endTime if it is less than current endTime
					var now = (0, _momentTimezone2.default)();
					var endTime = (0, _momentTimezone2.default)(workSession.dataValues.endTime);
					if (now < endTime) endTime = now;

					workSession.update({
						open: false,
						endTime: endTime
					}).then(function (workSession) {

						var WorkSessionId = workSession.id;
						var startTime = (0, _momentTimezone2.default)(workSession.startTime).tz(tz);
						var endTime = (0, _momentTimezone2.default)(workSession.dataValues.endTime).tz(tz);
						var endTimeString = endTime.format("h:mm a");
						var workSessionMinutes = Math.round(_momentTimezone2.default.duration(endTime.diff(startTime)).asMinutes());
						var workSessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(workSessionMinutes);

						workSession.getStoredWorkSession({
							where: ['"StoredWorkSession"."live" = ?', true]
						}).then(function (storedWorkSession) {

							var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
								return dailyTask.id;
							});

							// this is the only dailyTask associated with workSession
							user.getDailyTasks({
								where: ['"DailyTask"."id" IN (?)', dailyTaskIds],
								include: [_models2.default.Task]
							}).then(function (dailyTasks) {

								if (dailyTasks.length > 0) {
									(function () {

										var dailyTask = dailyTasks[0]; // one task per session

										// get all live daily tasks for use
										user.getDailyTasks({
											where: ['"DailyTask"."type" = ?', "live"],
											order: '"DailyTask"."priority" ASC',
											include: [_models2.default.Task]
										}).then(function (dailyTasks) {

											dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");

											// do our math update to daily task here
											var minutesSpent = dailyTask.minutesSpent;
											minutesSpent += workSessionMinutes;
											dailyTask.update({
												minutesSpent: minutesSpent
											}).then(function (dailyTask) {

												bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

													convo.sessionDone = {
														UserId: UserId,
														SlackUserId: SlackUserId,
														defaultBreakTime: defaultBreakTime,
														defaultSnoozeTime: defaultSnoozeTime,
														tz: tz,
														dailyTasks: dailyTasks,
														doneSessionEarly: doneSessionEarly,
														sessionTimerUp: sessionTimerUp,
														reminders: [],
														currentSession: {
															WorkSessionId: WorkSessionId,
															startTime: startTime,
															endTime: endTime,
															workSessionMinutes: workSessionMinutes,
															workSessionTimeString: workSessionTimeString,
															dailyTask: dailyTask,
															additionalMinutes: false
														},
														extendSession: false,
														postSessionDecision: false,
														priorityDecision: { // what we want to do with our priorities as a result of session
															replacePriority: {}, // config for totally new priority
															switchPriority: {} // config to switch priority worked on this session
														}
													};

													if (storedWorkSession) {
														workSessionMinutes = storedWorkSession.dataValues.minutes;
														workSessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(workSessionMinutes);
														// currently paused
														convo.doneSessionEarly.currentSession.isPaused = true;
														convo.doneSessionEarly.currentSession.workSessionTimeString = workSessionTimeString;
													}

													(0, _endWorkSessionFunctions.doneSessionAskOptions)(convo);

													convo.on('end', function (convo) {

														console.log("\n\n\n session is done!");
														console.log(convo.sessionDone.priorityDecision);
														console.log("\n\n\n");

														var _convo$sessionDone = convo.sessionDone;
														var UserId = _convo$sessionDone.UserId;
														var SlackUserId = _convo$sessionDone.SlackUserId;
														var reminders = _convo$sessionDone.reminders;
														var extendSession = _convo$sessionDone.extendSession;
														var postSessionDecision = _convo$sessionDone.postSessionDecision;
														var _convo$sessionDone$cu = _convo$sessionDone.currentSession;
														var WorkSessionId = _convo$sessionDone$cu.WorkSessionId;
														var workSessionMinutes = _convo$sessionDone$cu.workSessionMinutes;
														var dailyTask = _convo$sessionDone$cu.dailyTask;
														var priorityDecision = _convo$sessionDone.priorityDecision;

														// if extend session, rest doesn't matter!

														if (extendSession) {
															workSession.update({
																open: true,
																live: true,
																endTime: extendSession
															});
															return;
														}

														reminders.forEach(function (reminder) {
															var remindTime = reminder.remindTime;
															var customNote = reminder.customNote;
															var type = reminder.type;

															_models2.default.Reminder.create({
																UserId: UserId,
																remindTime: remindTime,
																customNote: customNote,
																type: type
															});
														});

														(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });

														// this is where you do the math with passed in info
														var replacePriority = priorityDecision.replacePriority;
														var switchPriority = priorityDecision.switchPriority;


														if (Object.keys(switchPriority).length > 0) {
															var newPriorityIndex = switchPriority.newPriorityIndex;

															console.log("\n\n\nokay dealing with switch priority!");
															console.log(dailyTasks[newPriorityIndex]);
															var newDailyTask = dailyTasks[newPriorityIndex];

															// 1. undo minutesSpent to dailyTask
															var _minutesSpent = dailyTask.dataValues.minutesSpent;

															_minutesSpent -= workSessionMinutes;
															dailyTask.update({
																minutesSpent: _minutesSpent
															});

															// 2. replace the dailyTask associated with current workSession
															_models2.default.WorkSessionTask.destroy({
																where: ['"WorkSessionTasks"."WorkSessionId" = ?', WorkSessionId]
															});
															_models2.default.WorkSessionTask.create({
																WorkSessionId: WorkSessionId,
																DailyTaskId: newDailyTask.dataValues.id
															}).then(function () {
																// 3. re-open workSession and re-trigger `done_session` flow
																_models2.default.WorkSession.update({
																	open: true
																}, {
																	where: ['"WorkSessions"."id" = ?', WorkSessionId]
																}).then(function () {

																	bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
																		convo.say('Okay! I put time towards that priority instead');
																		convo.next();
																		convo.on('end', function (convo) {
																			controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId }]);
																		});
																	});
																	return;
																});
															});
														} else if (Object.keys(replacePriority).length > 0) {
															(function () {
																var dailyTaskIndexToReplace = replacePriority.dailyTaskIndexToReplace;
																var newTaskText = replacePriority.newTaskText;

																console.log("\n\n\n replacing this task:");
																console.log(dailyTasks[dailyTaskIndexToReplace]);
																console.log(replacePriority);

																// 1. undo minutes to task
																var minutesSpent = dailyTask.dataValues.minutesSpent;

																minutesSpent -= workSessionMinutes;
																dailyTask.update({
																	minutesSpent: minutesSpent
																});

																// 2. change dailyTasks ("delete" the original one, then create this new one w/ NULL minutesAllocated)
																var dailyTaskToReplace = dailyTasks[dailyTaskIndexToReplace];
																var _dailyTaskToReplace$d = dailyTaskToReplace.dataValues;
																var id = _dailyTaskToReplace$d.id;
																var priority = _dailyTaskToReplace$d.priority;

																_models2.default.DailyTask.update({
																	type: "deleted"
																}, {
																	where: ['"DailyTasks"."id" = ?', id]
																});
																_models2.default.Task.create({
																	text: newTaskText
																}).then(function (task) {
																	task.createDailyTask({
																		priority: priority,
																		UserId: UserId
																	}).then(function (dailyTask) {

																		// 3. replace newly created dailyTask as the dailyTask to the workSession
																		var DailyTaskId = dailyTask.id;
																		_models2.default.WorkSessionTask.destroy({
																			where: ['"WorkSessionTasks"."WorkSessionId" = ?', WorkSessionId]
																		});
																		_models2.default.WorkSessionTask.create({
																			WorkSessionId: WorkSessionId,
																			DailyTaskId: DailyTaskId
																		}).then(function () {
																			// 4. re-open work session and go through `done_session` flow
																			_models2.default.WorkSession.update({
																				open: true
																			}, {
																				where: ['"WorkSessions"."id" = ?', WorkSessionId]
																			}).then(function () {

																				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
																					convo.say('Nice, that new priority looks great!');
																					convo.next();
																					convo.on('end', function (convo) {
																						controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId }]);
																					});
																				});
																				return;
																			});
																		});
																	});
																});
															})();
														}
													});
												});
											});
										});
									})();
								}
							});
						});
					});
				} else {

					var _config = { bot: bot, controller: controller, SlackUserId: SlackUserId };
					(0, _sessionOptions.notInSessionWouldYouLikeToStartOne)(_config);
				}
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _botResponses = require('../../lib/botResponses');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _constants = require('../../lib/constants');

var _endWorkSessionFunctions = require('../modules/endWorkSessionFunctions');

var _sessionOptions = require('./sessionOptions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=endWorkSession.js.map