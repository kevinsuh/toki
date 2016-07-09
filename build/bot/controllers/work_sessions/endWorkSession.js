'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

// END OF A WORK SESSION


exports.default = function (controller) {

	/**
  * 		ENDING WORK SESSION:
  * 			1) Explict command to finish session early
  * 			2) Your timer has run out
  */

	// User wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		/**
   * 			check if user has open session (should only be one)
   * 					if yes, trigger finish and end_session flow
   * 			  	if no, reply with confusion & other options
   */

		var SlackUserId = message.user;
		console.log("done message:");
		console.log(message);

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {

			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {
				return user.getWorkSessions({
					where: ['"open" = ?', true]
				});
			}).then(function (workSessions) {
				// if live work session, confirm end early
				// else, user MUST say `done` to trigger end (this properly simulates user is done with that session)
				if (workSessions.length > 0) {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.ask('Are you finished with your session?', [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								convo.finishedWithSession = true;
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								convo.say('Oh, never mind then! Keep up the work :weight_lifter:');
								convo.next();
							}
						}]);
						convo.on('end', function (convo) {
							if (convo.finishedWithSession) {
								controller.trigger('end_session', [bot, { SlackUserId: SlackUserId }]);
							}
						});
					});
				} else {
					// this is a bad solution right now
					// we need another column in WorkSessions to be `live`, which is different from `open` (`open` is for cronjob reminder, `done` is for when user explicitly ends the session.)
					if (message.text == 'done' || message.text == 'Done') {
						controller.trigger('end_session', [bot, { SlackUserId: SlackUserId }]);
					} else {
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say('I\'m not sure what you mean :thinking_face:. If you\'re finished with a session, reply `done`');
							convo.next();
						});
					}
				}
			});
		}, 1250);
	});

	/**
  * 			~~ START OF SESSION_TIMER FUNCTIONALITIES ~~
  */

	// session timer is up AND IN CONVO.ASK FLOW!
	controller.on('session_timer_up', function (bot, config) {

		/**
   * 		Timer is up. Give user option to extend session or start reflection
   */

		var SlackUserId = config.SlackUserId;
		var workSession = config.workSession;

		var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
			return dailyTask.id;
		});

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			user.getDailyTasks({
				where: ['"DailyTask"."id" IN (?) AND "Task"."done" = ?', dailyTaskIds, false],
				include: [_models2.default.Task]
			}).then(function (dailyTasks) {

				var taskTextsToWorkOnArray = dailyTasks.map(function (dailyTask) {
					var text = dailyTask.Task.dataValues.text;
					return text;
				});
				var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

				// making this just a reminder now so that user can end his own session as he pleases
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.doneSessionTimerObject = {
						SlackUserId: SlackUserId,
						sessionTimerDecision: false,
						dailyTaskIds: dailyTaskIds
					};

					var tz = user.SlackUser.tz;


					convo.sessionEnd = {
						UserId: user.id,
						tz: tz,
						postSessionDecision: false,
						reminders: [],
						tasksCompleted: [],
						SlackUserId: SlackUserId
					};

					var thirtyMinutes = 1000 * 60 * 30;

					setTimeout(function () {
						convo.doneSessionTimerObject.timeOut = true;
						convo.stop();
					}, thirtyMinutes);

					var message = '';
					if (dailyTasks.length == 0) {
						message = 'Hey, did you finish your tasks for this session?';
					} else {
						message = 'Hey, did you finish ' + tasksToWorkOnString + '?';
					}

					convo.ask({
						text: message,
						attachments: [{
							attachment_type: 'default',
							callback_id: "DONE_SESSION",
							fallback: "I was unable to process your decision",
							actions: [{
								name: _constants.buttonValues.doneSessionYes.name,
								text: "Yes! :punch:",
								value: _constants.buttonValues.doneSessionYes.value,
								type: "button",
								style: "primary"
							}, {
								name: _constants.buttonValues.doneSessionSnooze.name,
								text: "Snooze :timer_clock:",
								value: _constants.buttonValues.doneSessionSnooze.value,
								type: "button"
							}, {
								name: _constants.buttonValues.doneSessionDidSomethingElse.name,
								text: "Did something else",
								value: _constants.buttonValues.doneSessionDidSomethingElse.value,
								type: "button"
							}, {
								name: _constants.buttonValues.doneSessionNo.name,
								text: "Nope",
								value: _constants.buttonValues.doneSessionNo.value,
								type: "button"
							}]
						}]
					}, [{
						pattern: _constants.buttonValues.doneSessionYes.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didTask;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // same as buttonValues.doneSessionYes.value
						pattern: _botResponses.utterances.yes,
						callback: function callback(response, convo) {
							convo.say("Great work :raised_hands:");
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didTask;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, {
						pattern: _constants.buttonValues.doneSessionSnooze.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.snooze;
							convo.next();
						}
					}, { // same as buttonValues.doneSessionSnooze.value
						pattern: _botResponses.utterances.containsSnooze,
						callback: function callback(response, convo) {
							convo.say('Keep at it!');
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.snooze;

							// wit will pick up duration here
							var text = response.text;
							var duration = response.intentObject.entities.duration;

							convo.doneSessionTimerObject.customSnooze = {
								text: text,
								duration: duration
							};

							convo.next();
						}
					}, { // this just triggers `end_session` flow
						pattern: _constants.buttonValues.doneSessionDidSomethingElse.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didSomethingElse;
							convo.next();
						}
					}, { // same as buttonValues.doneSessionDidSomethingElse.value
						pattern: _botResponses.utterances.containsElse,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didSomethingElse;
							convo.say(':ocean: Woo!');
							convo.next();
						}
					}, {
						pattern: _constants.buttonValues.doneSessionNo.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.noTasks;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // same as buttonValues.doneSessionNo.value
						pattern: _botResponses.utterances.no,
						callback: function callback(response, convo) {
							convo.say('That\'s okay! You can keep chipping away and you\'ll get there :pick:');
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.noTasks;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // this is failure point. restart with question
						default: true,
						callback: function callback(response, convo) {
							convo.say("I didn't quite get that :thinking_face:");
							convo.repeat();
							convo.next();
						}
					}]);
					convo.next();

					convo.on('end', function (convo) {
						var _convo$sessionEnd = convo.sessionEnd;
						var postSessionDecision = _convo$sessionEnd.postSessionDecision;
						var reminders = _convo$sessionEnd.reminders;
						var _convo$doneSessionTim = convo.doneSessionTimerObject;
						var dailyTaskIds = _convo$doneSessionTim.dailyTaskIds;
						var timeOut = _convo$doneSessionTim.timeOut;
						var SlackUserId = _convo$doneSessionTim.SlackUserId;
						var sessionTimerDecision = _convo$doneSessionTim.sessionTimerDecision;
						var customSnooze = _convo$doneSessionTim.customSnooze;


						_models2.default.User.find({
							where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
							include: [_models2.default.SlackUser]
						}).then(function (user) {

							if (timeOut) {

								user.getWorkSessions({
									where: ['"WorkSession"."open" = ?', true]
								}).then(function (workSessions) {
									// only if there are still "open" work sessions
									if (workSessions.length > 0) {
										var sentMessages = bot.sentMessages;

										if (sentMessages) {
											// lastMessage is the one just asked by `convo`
											// in this case, it is `taskListMessage`
											var lastMessage = sentMessages.slice(-1)[0];
											if (lastMessage) {
												var channel = lastMessage.channel;
												var ts = lastMessage.ts;

												var doneSessionMessageObject = {
													channel: channel,
													ts: ts
												};
												bot.api.chat.delete(doneSessionMessageObject);
											}
										}

										// this was a 30 minute timeout for done_session timer!
										controller.trigger('done_session_timeout_flow', [bot, { SlackUserId: SlackUserId, workSession: workSession }]);
									};
								});
							} else {
								var _ret = function () {

									convo.doneSessionTimerObject.timeOut = false;

									// NORMAL FLOW
									var UserId = user.id;

									// cancel all old reminders
									user.getReminders({
										where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break", "done_session_snooze"]]
									}).then(function (oldReminders) {
										oldReminders.forEach(function (reminder) {
											reminder.update({
												"open": false
											});
										});
									});

									switch (sessionTimerDecision) {
										case _constants.sessionTimerDecisions.didTask:
											// update the specific task finished
											user.getDailyTasks({
												where: ['"DailyTask"."id" IN (?)', dailyTaskIds],
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
											break;
										case _constants.sessionTimerDecisions.snooze:

											if (customSnooze) {
												var text = customSnooze.text;
												var duration = customSnooze.duration;

												// user only said `snooze`

												if (_botResponses.utterances.onlyContainsSnooze.test(text)) {
													// automatically do default snooze here then
													controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId }]);
												} else {
													// user said `snooze for X minutes`
													controller.trigger('snooze_reminder_flow', [bot, { SlackUserId: SlackUserId, duration: duration }]);
												}
											} else {
												// button triggered it (do default)
												controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId }]);
											}

											return {
												v: void 0
											};
										case _constants.sessionTimerDecisions.didSomethingElse:
											controller.trigger('end_session', [bot, { SlackUserId: SlackUserId }]);
											return {
												v: void 0
											};
										case _constants.sessionTimerDecisions.noTasks:
											// nothing
											break;
										default:
											break;
									}

									/**
          * 		~~ THIS IS SIMULATION OF `session_end` FLOW
          * 		essentially figuring out postSessionDecision
          */

									// end all OPEN work sessions here, because user
									// ~~ CLOSING a work session MUST ALSO MAKE IT NOT LIVE!! ~~
									// has decided to PROACTIVELY CLOSE IT
									user.getWorkSessions({
										where: ['"WorkSession"."open" = ?', true],
										order: '"createdAt" DESC'
									}).then(function (workSessions) {
										workSessions.forEach(function (workSession) {
											workSession.update({
												open: false,
												live: false
											});
										});

										// then from here, active the postSessionDecisions
										setTimeout(function () {
											handlePostSessionDecision(postSessionDecision, { controller: controller, bot: bot, SlackUserId: SlackUserId });
										}, 500);
									});

									// set reminders (usually a break)
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
								}();

								if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
							};
						});
					});
				});
			});
		});
	});

	/**
  * 			~~ START OF END_SESSION FLOW FUNCTIONALITIES ~~
  */

	// the actual end_session flow
	controller.on('end_session', function (bot, config) {

		/**
   * 		User has agreed for session to end at this point
   */

		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			// object that contains values important to this conversation
			convo.sessionEnd = {
				SlackUserId: SlackUserId,
				postSessionDecision: false, // what is the user's decision? (break, another session, etc.)
				reminders: [], // there will be lots of potential reminders
				tasksCompleted: []
			};

			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				// need user's timezone for this flow!
				var tz = user.SlackUser.tz;

				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				}

				convo.sessionEnd.UserId = user.id;
				convo.sessionEnd.tz = tz;

				return user.getDailyTasks({
					where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
					order: '"DailyTask"."priority" ASC',
					include: [_models2.default.Task]
				});
			}).then(function (dailyTasks) {

				var taskArray = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
				convo.sessionEnd.taskArray = taskArray;
				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray);

				if (taskArray.length == 0) {
					convo.say("You don't have any tasks on today's list! Great work :punch:");
					convo.sessionEnd.hasNoTasksToWorkOn = true;
					askUserPostSessionOptions(err, convo);
					convo.next();
				} else {
					convo.say("Which task(s) did you get done? `i.e. tasks 1, 2`");
					convo.ask({
						text: '' + taskListMessage,
						attachments: [{
							attachment_type: 'default',
							callback_id: "FINISH_TASKS_ON_END_SESSION",
							fallback: "I was unable to process your decision",
							color: _constants.colorsHash.grey.hex,
							actions: [{
								name: _constants.buttonValues.differentTask.name,
								text: "Something Else",
								value: _constants.buttonValues.differentTask.value,
								type: "button"
							}, {
								name: _constants.buttonValues.noTasks.name,
								text: "None yet!",
								value: _constants.buttonValues.noTasks.value,
								type: "button"
							}]
						}]
					}, [{
						pattern: _constants.buttonValues.noTasks.value,
						callback: function callback(response, convo) {
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // same as clicking buttonValues.noTasks.value
						pattern: _botResponses.utterances.containsNone,
						callback: function callback(response, convo) {
							convo.say("No worries! :smile_cat:");
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, {
						pattern: _constants.buttonValues.differentTask.value,
						callback: function callback(response, convo) {
							askForDifferentCompletedTask(response, convo);
							convo.next();
						}
					}, { // same as clicking buttonValues.differentTask.value
						pattern: _botResponses.utterances.containsDifferent,
						callback: function callback(response, convo) {
							convo.say("What did you get done instead?");
							askForDifferentCompletedTask(response, convo);
							convo.next();
						}
					}, { // user has listed task numbers here
						default: true,
						callback: function callback(response, convo) {

							// user inputed task #'s (`2,4,1`), not new task button
							var entities = response.intentObject.entities;

							var tasksCompletedString = response.text;

							var taskNumberCompletedArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksCompletedString, taskArray);

							// repeat convo if invalid w/ informative context
							if (taskNumberCompletedArray) {

								// get the actual ids
								var tasksCompletedArray = [];
								taskNumberCompletedArray.forEach(function (taskNumber) {
									var index = taskNumber - 1; // to make 0-index based
									if (taskArray[index]) tasksCompletedArray.push(taskArray[index].dataValues.id);
								});

								convo.sessionEnd.tasksCompleted = tasksCompletedArray;
								convo.say("Great work :punch:");
								askUserPostSessionOptions(response, convo);
							} else {

								convo.say("Oops, I don't totally understand :dog:. Let's try this again");
								convo.say("You can pick a task from your list `i.e. tasks 1, 3` or say `none`");
								convo.repeat();
							}
							convo.next();
						}
					}]);
				}
			});

			convo.on('end', function (convo) {
				console.log("SESSION END!!!");

				var responses = convo.extractResponses();
				var sessionEnd = convo.sessionEnd;


				if (convo.status == 'completed') {
					(function () {

						console.log("CONVO SESSION END: ");
						console.log(convo.sessionEnd);

						// went according to plan
						var _convo$sessionEnd2 = convo.sessionEnd;
						var SlackUserId = _convo$sessionEnd2.SlackUserId;
						var UserId = _convo$sessionEnd2.UserId;
						var postSessionDecision = _convo$sessionEnd2.postSessionDecision;
						var reminders = _convo$sessionEnd2.reminders;
						var tasksCompleted = _convo$sessionEnd2.tasksCompleted;
						var taskArray = _convo$sessionEnd2.taskArray;
						var differentCompletedTask = _convo$sessionEnd2.differentCompletedTask;
						var tz = _convo$sessionEnd2.tz;

						// end all live sessions and reminder checkins (type `work_session`) the user might have

						_models2.default.User.find({
							where: ['"User"."id" = ?', UserId],
							include: [_models2.default.SlackUser]
						}).then(function (user) {

							/**
        * 		~~ END OF WORK SESSION ~~
        * 			1. cancel all `break` and `checkin` reminders
        * 			2. mark said `tasks` as done
        * 			3. handle postSession decision (set `break` reminder, start new session, etc.)
        * 			4. close all live worksessions
        * 			5. if completed diff task, store that for user
        */

							// cancel all checkin reminders (type: `work_session` or `break`)
							// AFTER this is done, put in new break
							user.getReminders({
								where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break", "done_session_snooze"]]
							}).then(function (oldReminders) {
								oldReminders.forEach(function (reminder) {
									reminder.update({
										"open": false
									});
								});
							});

							// set reminders (usually a break)
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

							// mark appropriate tasks as done
							tasksCompleted.forEach(function (TaskId) {
								_models2.default.DailyTask.find({
									where: { id: TaskId },
									include: [_models2.default.Task]
								}).then(function (dailyTask) {
									if (dailyTask) {
										dailyTask.Task.updateAttributes({
											done: true
										});
									}
								});
							});

							// end all OPEN work sessions here b/c user has closed it officially
							// LIVE work sessions only matter through CRON JOB
							// make decision afterwards (to ensure you have no sessions live if u want to start a new one)
							user.getWorkSessions({
								where: ['"WorkSession"."open" =? ', true],
								order: '"createdAt" DESC'
							}).then(function (workSessions) {

								var endTime = (0, _momentTimezone2.default)();
								// IF you chose a new task not on your list to have completed
								if (differentCompletedTask) {

									var minutes; // calculate time worked on that task
									if (workSessions.length > 0) {

										// use this to get how long the
										// custom added task took
										var startSession = workSessions[0];
										var startTime = (0, _momentTimezone2.default)(startSession.startTime);
										minutes = _momentTimezone2.default.duration(endTime.diff(startTime)).asMinutes();
									} else {
										// this should never happen.
										minutes = 30; // but if it does... default minutes duration
									}

									// create new task that the user just got done
									user.getDailyTasks({
										where: ['"DailyTask"."type" = ?', "live"]
									}).then(function (dailyTasks) {
										var priority = dailyTasks.length + 1;
										var text = differentCompletedTask;
										// record the different completed task
										_models2.default.Task.create({
											text: text,
											done: true
										}).then(function (task) {
											var TaskId = task.id;
											_models2.default.DailyTask.create({
												TaskId: TaskId,
												priority: priority,
												minutes: minutes,
												UserId: UserId
											});
										});
									});
								}

								workSessions.forEach(function (workSession) {
									workSession.update({
										endTime: endTime,
										open: false,
										live: false
									});
								});

								setTimeout(function () {
									handlePostSessionDecision(postSessionDecision, { controller: controller, bot: bot, SlackUserId: SlackUserId });
								}, 500);
							});
						});
					})();
				} else {
					// FIX POTENTIAL PITFALLS HERE
					if (!sessionEnd.postSessionDecision) {
						convo.say("I'm not sure went wrong here :dog: Please let my owners know");
					}
				}
			});
		});
	});
};

exports.askUserPostSessionOptions = askUserPostSessionOptions;
exports.handlePostSessionDecision = handlePostSessionDecision;

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

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ask user for options after finishing session
function askUserPostSessionOptions(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	// only if first time!
	// convo.say("I recommend taking a 15 minute break after about 90 minutes of focused work to keep your mind and attention fresh :tangerine:");
	// convo.say("Breaks are great times to read books and articles, or take a walk outside to get some fresh air :books: :walking:");

	convo.ask({
		text: 'Would you like to take a break now, or start a new session?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "END_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.takeBreak.name,
				text: "Take a break",
				value: _constants.buttonValues.takeBreak.value,
				type: "button"
			}, {
				name: _constants.buttonValues.startSession.name,
				text: "Another session :muscle:",
				value: _constants.buttonValues.startSession.value,
				type: "button"
			}, {
				name: _constants.buttonValues.backLater.name,
				text: "Be Back Later",
				value: _constants.buttonValues.backLater.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End my day :sleeping:",
				value: _constants.buttonValues.endDay.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.takeBreak.value,
		callback: function callback(response, convo) {
			getBreakTime(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.takeBreak.value
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {
			console.log(_botResponses.utterances.containsBreak);
			getBreakTime(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startSession.value,
		callback: function callback(response, convo) {
			convo.sessionEnd.postSessionDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startSession.value
		pattern: _botResponses.utterances.startSession,
		callback: function callback(response, convo) {
			convo.sessionEnd.postSessionDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.endDay.value,
		callback: function callback(response, convo) {
			convo.sessionEnd.postSessionDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.endDay.value
		pattern: _botResponses.utterances.containsEnd,
		callback: function callback(response, convo) {
			convo.sessionEnd.postSessionDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.backLater.value,
		callback: function callback(response, convo) {
			handleBeBackLater(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.backLater.value
		pattern: _botResponses.utterances.containsBackLater,
		callback: function callback(response, convo) {
			convo.say("Okay! I'll be here when you get back");
			handleBeBackLater(response, convo);
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :dog:. Let's choose an option from the buttons for now");
			convo.repeat();
			convo.next();
		}
	}]);
}

// user has completed a different task and we'll take note
function askForDifferentCompletedTask(response, convo) {
	convo.ask("I'll add it as a completed task for you :memo:", function (response, convo) {
		convo.sessionEnd.differentCompletedTask = response.text;
		convo.say("Noted!");
		askUserPostSessionOptions(response, convo);
		convo.next();
	});
}

// simple way to handle be back later
function handleBeBackLater(response, convo) {
	convo.say("You can also ask for me to check in with you at a specific time later :grin:");
}

// handle break time
// if button click: ask for time, recommend 15 min
// if NL break w/ no time: ask for time, recommend 15 min
// if NL break w/ time: streamline break w/ time
function getBreakTime(response, convo) {
	var entities = response.intentObject.entities;
	var tz = convo.sessionEnd.tz;


	convo.sessionEnd.postSessionDecision = _intents2.default.WANT_BREAK; // user wants a break!

	var durationSeconds = 0;
	if (entities.duration) {
		var durationArray = entities.duration;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		convo.sessionEnd.breakDuration = durationMinutes;

		// calculate break time and add reminder
		var customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(durationMinutes, 'minutes');
		var customTimeString = customTimeObject.format("h:mm a");

		convo.say('Great! I\'ll check in with you in ' + durationMinutes + ' minutes at *' + customTimeString + '* :smile:');
		convo.sessionEnd.reminders.push({
			customNote: 'It\'s been ' + durationMinutes + ' minutes. Let me know when you\'re ready to start a session',
			remindTime: customTimeObject,
			type: "break"
		});
	} else {

		convo.ask("How long do you want to take a break? I recommend 15 minutes for every 90 minutes of work :grin:", function (response, convo) {

			var timeToTask = response.text;

			var validMinutesTester = new RegExp(/[\dh]/);
			var isInvalid = false;
			if (!validMinutesTester.test(timeToTask)) {
				isInvalid = true;
			}

			// INVALID tester
			if (isInvalid) {
				convo.say("Oops, looks like you didn't put in valid minutes :thinking_face:. Let's try this again");
				convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `1 hour 15 min`");
				convo.repeat();
			} else {

				var durationMinutes = (0, _messageHelpers.convertTimeStringToMinutes)(timeToTask);
				var customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(durationMinutes, 'minutes');
				var customTimeString = customTimeObject.format("h:mm a");

				convo.sessionEnd.breakDuration = durationMinutes;

				convo.say('Great! I\'ll check in with you in ' + durationMinutes + ' minutes at *' + customTimeString + '* :smile:');

				// calculate break time and add reminder
				convo.sessionEnd.reminders.push({
					customNote: 'It\'s been ' + durationMinutes + ' minutes. Let me know when you\'re ready to start a session',
					remindTime: customTimeObject,
					type: "break"
				});
			}
			convo.next();
		});
	}
}

// NEED ALL 3 FOR CONFIG: SlackUserId, controller, bot
function handlePostSessionDecision(postSessionDecision, config) {
	var SlackUserId = config.SlackUserId;
	var controller = config.controller;
	var bot = config.bot;


	switch (postSessionDecision) {
		case _intents2.default.WANT_BREAK:
			break;
		case _intents2.default.END_DAY:
			controller.trigger('trigger_day_end', [bot, { SlackUserId: SlackUserId }]);
			break;
		case _intents2.default.START_SESSION:
			controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
			break;
		default:
			break;
	}
}
//# sourceMappingURL=endWorkSession.js.map