'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

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
				// if open work session, confirm end early
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
					if (message.text == 'done') {
						controller.trigger('end_session', [bot, { SlackUserId: SlackUserId }]);
					} else {
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say('I\'m not absolutely sure what you mean :thinking_face:. If you\'re finished with a session, reply `done`');
							convo.next();
						});
					}
				}
			});
		}, 1250);
	});

	// session timer is up
	controller.on('session_timer_up', function (bot, config) {

		/**
   * 		Timer is up. Give user option to extend session or start reflection
   */

		var SlackUserId = config.SlackUserId;

		// making this just a reminder now so that user can end his own session as he pleases

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say(':timer_clock: time\'s up. Reply `done` when you\'re ready to end the session');
			convo.next();
		});
	});

	// the actual end_session flow
	controller.on('end_session', function (bot, config) {

		/**
   * 		User has agreed for session to end at this point
   */

		var SlackUserId = config.SlackUserId;


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

				convo.sessionEnd.UserId = user.id;

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
						text: taskListMessage,
						attachments: [{
							attachment_type: 'default',
							callback_id: "FINISH_TASKS_ON_END_SESSION",
							fallback: "I was unable to process your decision",
							color: _constants.colorsHash.grey.hex,
							actions: [{
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
						default: true,
						callback: function callback(response, convo) {
							// user inputed task #'s, not new task button
							var entities = response.intentObject.entities;

							var tasksCompleted = response.text;
							var tasksCompletedSplitArray = tasksCompleted.split(/(,|and)/);

							// if we capture 0 valid tasks from string, then we start over
							var numberRegEx = new RegExp(/[\d]+/);
							var taskNumberCompletedArray = [];
							tasksCompletedSplitArray.forEach(function (taskString) {
								console.log('task string: ' + taskString);
								var taskNumber = taskString.match(numberRegEx);
								if (taskNumber) {
									taskNumber = parseInt(taskNumber[0]);
									if (taskNumber <= taskArray.length) {
										taskNumberCompletedArray.push(taskNumber);
									}
								}
							});

							// invalid if we captured no tasks
							var isInvalid = taskNumberCompletedArray.length == 0 ? true : false;
							// repeat convo if invalid w/ informative context
							if (isInvalid) {
								convo.say("Oops, I don't totally understand :dog:. Let's try this again");
								convo.say("You can pick a task from your list `i.e. tasks 1, 3` or say `none`");
								convo.repeat();
							} else {
								// get the actual ids
								var tasksCompletedArray = [];
								taskNumberCompletedArray.forEach(function (taskNumber) {
									var index = taskNumber - 1; // to make 0-index based
									if (taskArray[index]) tasksCompletedArray.push(taskArray[index].dataValues.id);
								});

								convo.sessionEnd.tasksCompleted = tasksCompletedArray;
								convo.say("Great work :punch:");
								askUserPostSessionOptions(response, convo);
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
						var _convo$sessionEnd = convo.sessionEnd;
						var SlackUserId = _convo$sessionEnd.SlackUserId;
						var UserId = _convo$sessionEnd.UserId;
						var postSessionDecision = _convo$sessionEnd.postSessionDecision;
						var reminders = _convo$sessionEnd.reminders;
						var tasksCompleted = _convo$sessionEnd.tasksCompleted;
						var taskArray = _convo$sessionEnd.taskArray;

						// end all open sessions and reminder checkins (type `work_session`) the user might have

						_models2.default.User.find({
							where: ['"User"."id" = ?', UserId],
							include: [_models2.default.SlackUser]
						}).then(function (user) {

							/**
        * 		~~ END OF WORK SESSION ~~
        * 			1. cancel all `break` and `checkin` reminders
        * 			2. mark said `tasks` as done
        * 			3. set new `reminders` (i.e break)
        * 			4. close open worksessions and start new one if requested
        */

							// cancel all checkin reminders (type: `work_session` or `break`)
							// AFTER this is done, put in new break
							user.getReminders({
								where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break"]]
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
							taskArray.forEach(function (task) {
								if (tasksCompleted.indexOf(task.dataValues.id) > -1) {
									// get daily tasks
									_models2.default.DailyTask.find({
										where: { id: task.dataValues.id },
										include: [_models2.default.Task]
									}).then(function (dailyTask) {
										if (dailyTask) {
											dailyTask.Task.updateAttributes({
												done: true
											});
										}
									});
								}
							});

							// end all open work sessions
							// make decision afterwards (to ensure you have no sessions open if u want to start a new one)
							user.getWorkSessions({
								where: ['"open" = ?', true]
							}).then(function (workSessions) {
								var endTime = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss");
								workSessions.forEach(function (workSession) {
									workSession.update({
										endTime: endTime,
										"open": false
									});
								});

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
							});
						});
					})();
				} else {
					// ending convo prematurely
					console.log("ending convo early: \n\n\n\n");
					console.log("controller:");
					console.log(controller);
					console.log("\n\n\n\n\nbot:");
					console.log(bot);

					// FIX POTENTIAL PITFALLS HERE
					if (!sessionEnd.postSessionDecision) {
						convo.say("I'm not sure went wrong here :dog: Please let my owners know");
					}
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

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ask user for options after finishing session


// END OF A WORK SESSION
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

	convo.sessionEnd.postSessionDecision = _intents2.default.WANT_BREAK; // user wants a break!

	var durationSeconds = 0;
	if (entities.duration) {
		var durationArray = entities.duration;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		convo.sessionEnd.breakDuration = durationMinutes;
		convo.say('Great! I\'ll check in with you in ' + durationMinutes + ' minutes :smile:');
		// calculate break time and add reminder
		var checkinTimeStamp = (0, _momentTimezone2.default)().add(durationMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
		convo.sessionEnd.reminders.push({
			customNote: 'It\'s been ' + durationMinutes + ' minutes. Let me know when you\'re ready to start a session',
			remindTime: checkinTimeStamp,
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
				var customTimeObject = (0, _momentTimezone2.default)().add(durationMinutes, 'minutes');
				var customTimeString = customTimeObject.format("h:mm a");

				convo.sessionEnd.breakDuration = durationMinutes;
				convo.say('Great! I\'ll check in with you in ' + durationMinutes + ' minutes :smile:');
				// calculate break time and add reminder
				var checkinTimeStamp = (0, _momentTimezone2.default)().add(durationMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
				convo.sessionEnd.reminders.push({
					customNote: 'It\'s been ' + durationMinutes + ' minutes. Let me know when you\'re ready to start a session',
					remindTime: checkinTimeStamp,
					type: "break"
				});
			}
			convo.next();
		});
	}
}
//# sourceMappingURL=endWorkSession.js.map