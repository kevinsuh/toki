'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *
  * 		User directly asks to start a session
  * 							~* via Wit *~
  * 		     this makes sure you are properly in
  * 		     				in a "SessionGroup" before
  * 		     			working on your session
  */
	controller.hears(['start_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var intent = _intents2.default.START_SESSION;

		var config = {
			intent: intent,
			SlackUserId: SlackUserId
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('new_session_group_decision', [bot, config]);
		}, 1000);
	});

	/**
  * 				EVERY CREATED SESSION GOES THROUGH THIS FIRST
  *   		*** this checks if there is an existing open session ***
  *   			if no open sessions => `begin_session`
  *   			else => go through this flow
  */
	controller.on('confirm_new_session', function (bot, config) {

		/**
   * 		User can either:
   * 			1. Keep going
   * 			2. Start new session by ending this one early
   * 					- update endTime in session to now
   * 					- mark it as done and re-enter `begin_session`
   */

		var SlackUserId = config.SlackUserId;

		console.log("\n\n\n\n\nin `confirm_new_session` before entering begin_session flow!\n\n\n\n\n");

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.getWorkSessions({
				where: ['"open" = ?', true]
			}).then(function (workSessions) {

				// no open work sessions => you're good to go!
				if (workSessions.length == 0) {
					controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
					return;
				}

				// otherwise, we gotta confirm user wants to cancel current work session

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					// by default, user wants to start a new session
					// that's why she is in this flow...
					// no openWorkSession unless we found one
					convo.startNewSession = true;
					convo.openWorkSession = false;

					var openWorkSession = workSessions[0]; // deal with first one as reference point
					convo.openWorkSession = openWorkSession;

					var endTime = (0, _momentTimezone2.default)(openWorkSession.endTime);
					var endTimeString = endTime.format("h:mm a");
					var now = (0, _momentTimezone2.default)();
					var minutesLeft = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes());

					convo.say('You are already in a session right now! You have ' + minutesLeft + ' minutes left :timer_clock:');
					convo.ask('Do you want to `keep going`, or cancel it and start a `new session`?', function (response, convo) {

						var responseMessage = response.text;
						var entities = response.intentObject.entities;


						var newSession = new RegExp(/(((^st[tart]*))|(^ne[ew]*)|(^se[ession]*))/); // `start` or `new`
						var keepGoing = new RegExp(/(((^k[ep]*))|(^go[oing]*))/); // `keep` or `going`

						if (newSession.test(responseMessage)) {

							// start new session
							convo.say("Got it. Let's do a new session :facepunch:");
						} else if (keepGoing.test(responseMessage)) {

							// continue current session
							convo.say("Got it. Let's do it! :weight_lifter:");
							convo.say('I\'ll ping you at ' + endTimeString + ' :alarm_clock:');
							convo.startNewSession = false;
						} else {

							// invalid
							convo.say("I'm sorry, I didn't catch that :dog:");
							convo.repeat();
						}
						convo.next();
					});

					convo.on('end', function (convo) {

						console.log("\n\n\n ~~ here in end of confirm_new_session ~~ \n\n\n");

						var startNewSession = convo.startNewSession;
						var openWorkSession = convo.openWorkSession;

						// if user wants to start new session, then do this flow and enter `begin_session` flow

						if (startNewSession) {

							/**
        * 		~ User has confirmed starting a new session ~
        * 			* end current work session early
        * 			* cancel all existing open work sessions
        * 			* cancel `break` reminders
        */

							var nowTimeStamp = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss");

							// if user had an open work session(s), cancel them!
							if (openWorkSession) {
								openWorkSession.update({
									endTime: nowTimeStamp,
									open: false
								});
								workSessions.forEach(function (workSession) {
									workSession.update({
										open: false
									});
								});
							};

							// cancel all user breaks cause user is RDY TO WORK
							_models2.default.User.find({
								where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
								include: [_models2.default.SlackUser]
							}).then(function (user) {
								user.getReminders({
									where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break"]]
								}).then(function (reminders) {
									reminders.forEach(function (reminder) {
										reminder.update({
											"open": false
										});
									});
								});
							});

							controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
						}
					});
				});
			});
		});
	});

	/**
  * 		ACTUAL START SESSION FLOW
  * 		this will begin the start_session flow with user
  *
  * 			- start work session
  * 			- show and decide tasks to work on
  * 			- decide session duration
  */
	controller.on('begin_session', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var name = user.nickName || user.email;

				// configure necessary properties on convo object
				convo.name = name;

				// object that contains values important to this conversation
				convo.sessionStart = {
					UserId: user.id,
					SlackUserId: SlackUserId
				};

				// temporary fix to get tasks
				var timeAgoForTasks = (0, _momentTimezone2.default)().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");

				// FIND DAILY TASKS, THEN START THE CONVERSATION
				user.getDailyTasks({
					where: ['"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?', timeAgoForTasks, false, "live"],
					order: '"priority" ASC',
					include: [_models2.default.Task]
				}).then(function (dailyTasks) {

					// save the daily tasks for reference
					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
					convo.sessionStart.dailyTasks = dailyTasks;

					// user needs to enter daily tasks
					if (dailyTasks.length == 0) {
						convo.sessionStart.noDailyTasks = true;
						convo.stop();
					} else {
						// entry point of thy conversation
						startSessionStartConversation(err, convo);
					}
				});

				// on finish convo
				convo.on('end', function (convo) {

					var responses = convo.extractResponses();
					var sessionStart = convo.sessionStart;
					var SlackUserId = sessionStart.SlackUserId;

					// proxy that some odd bug has happened
					// impossible to have 1+ daily tasks and no time estimate

					if (sessionStart.dailyTasks.length > 0 && !sessionStart.calculatedTimeObject) {

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say("Sorry but something went wrong :dog:. Please try `start a session` again");
							convo.next();
						});

						return;
					}

					if (convo.status == 'completed') {

						console.log("finished and this is the data:");
						console.log(sessionStart);

						/**
       * 		1. tell user time and tasks to work on
       * 		
       *		2. save responses to DB:
       *			session:
       *				- tasks to work on (tasksToWorkOnHash)
       *				- sessionEndTime (calculated)
       *				- reminder (time + possible customNote)
       *
       * 		3. start session
       */

						var UserId = sessionStart.UserId;
						var SlackUserId = sessionStart.SlackUserId;
						var dailyTasks = sessionStart.dailyTasks;
						var calculatedTime = sessionStart.calculatedTime;
						var calculatedTimeObject = sessionStart.calculatedTimeObject;
						var tasksToWorkOnHash = sessionStart.tasksToWorkOnHash;
						var checkinTimeObject = sessionStart.checkinTimeObject;
						var reminderNote = sessionStart.reminderNote;

						// if user wanted a checkin reminder

						if (checkinTimeObject) {
							var checkInTimeStamp = checkinTimeObject.format("YYYY-MM-DD HH:mm:ss");
							_models2.default.Reminder.create({
								remindTime: checkInTimeStamp,
								UserId: UserId,
								customNote: reminderNote,
								type: "work_session"
							});
						}

						// 1. create work session
						// 2. attach the daily tasks to work on during that work session
						var startTime = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss");
						var endTime = calculatedTimeObject.format("YYYY-MM-DD HH:mm:ss");

						// create necessary data models:
						// 	array of Ids for insert, taskObjects to create taskListMessage
						var dailyTaskIds = [];
						var tasksToWorkOnArray = [];
						for (var key in tasksToWorkOnHash) {
							var task = tasksToWorkOnHash[key];
							dailyTaskIds.push(task.dataValues.id);
							tasksToWorkOnArray.push(task);
						}

						_models2.default.WorkSession.create({
							startTime: startTime,
							endTime: endTime,
							UserId: UserId
						}).then(function (workSession) {
							workSession.setDailyTasks(dailyTaskIds);
						});

						var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasksToWorkOnArray);

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say('Excellent! See you at ' + calculatedTime + '! :timer_clock:');
							convo.say('Good luck with: \n' + taskListMessage);
							convo.next();
						});
					} else {

						// ending convo prematurely

						if (sessionStart.noDailyTasks) {
							var fiveHoursAgo;

							(function () {
								var task = convo.task;
								var bot = task.bot;
								var source_message = task.source_message;
								fiveHoursAgo = new Date((0, _momentTimezone2.default)().subtract(5, 'hours'));

								user.getWorkSessions({
									where: ['"WorkSession"."endTime" > ?', fiveHoursAgo]
								}).then(function (workSessions) {

									// start a new day if you have not had a work session in 5 hours
									var startNewDay = workSessions.length == 0 ? true : false;
									bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

										convo.startNewDay = startNewDay;

										if (startNewDay) {
											convo.say("Hey! You haven't entered any tasks yet today. Let's start the day before doing a session :muscle:");
										} else {
											convo.say("Hey! You actually don't have any tasks right now. Let's get things to work on first");
										}

										convo.next();
										convo.on('end', function (convo) {
											// go to start your day from here
											var config = { SlackUserId: SlackUserId };
											var startNewDay = convo.startNewDay;


											if (startNewDay) {
												controller.trigger('begin_day_flow', [bot, config]);
											} else {
												controller.trigger('add_task_flow', [bot, config]);
											}
										});
									});
								});
							})();
						} else {
							// default premature end!
							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
								convo.say("Okay! Exiting now. Let me know when you want to start on a session");
								convo.next();
							});
						}
					}
				});
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// user just started conversation and is choosing which tasks to work on
function startSessionStartConversation(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart = convo.sessionStart;
	var UserId = _convo$sessionStart.UserId;
	var dailyTasks = _convo$sessionStart.dailyTasks;


	convo.say("Let's do it :weight_lifter:");
	convo.say('Which tasks would you like to work on?');

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	convo.say(taskListMessage);
	convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");

	askWhichTasksToWorkOn(response, convo);
	convo.next();
}

// confirm user for the tasks and


// START OF A WORK SESSION
function askWhichTasksToWorkOn(response, convo) {
	convo.ask("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:", function (response, convo) {
		confirmTasks(response, convo);
		convo.next();
	}, { 'key': 'tasksToWorkOn' });
}

function confirmTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var dailyTasks = convo.sessionStart.dailyTasks;
	var tasksToWorkOn = convo.responses.tasksToWorkOn;

	var tasksToWorkOnSplitArray = tasksToWorkOn.text.split(/(,|and)/);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx = new RegExp(/[\d]+/);
	var taskNumbersToWorkOnArray = []; // user assigned task numbers
	tasksToWorkOnSplitArray.forEach(function (taskString) {
		console.log('task string: ' + taskString);
		var taskNumber = taskString.match(numberRegEx);
		if (taskNumber) {
			taskNumber = parseInt(taskNumber[0]);
			if (taskNumber <= dailyTasks.length) {
				taskNumbersToWorkOnArray.push(taskNumber);
			}
		}
	});

	// invalid if we captured no tasks
	var isInvalid = taskNumbersToWorkOnArray.length == 0 ? true : false;
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	// repeat convo if invalid w/ informative context
	if (isInvalid) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
		convo.say(taskListMessage);
		askWhichTasksToWorkOn(response, convo);
		return;
	}

	// if not invalid, we can set the tasksToWorkOnArray
	var tasksToWorkOnHash = {}; // organize by task number assigned from user
	taskNumbersToWorkOnArray.forEach(function (taskNumber) {
		var index = taskNumber - 1; // make this 0-index based
		if (dailyTasks[index]) tasksToWorkOnHash[taskNumber] = dailyTasks[index];
	});

	convo.ask('To :heavy_check_mark:, you want to work on tasks: ' + taskNumbersToWorkOnArray.join(", ") + '?', [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			confirmTimeForTasks(response, convo);
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Let's give this another try then :repeat_one:");
			convo.say(taskListMessage);
			askWhichTasksToWorkOn(response, convo);
			convo.next();
		}
	}]);
}

// calculate ask about the time to the given tasks
function confirmTimeForTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart2 = convo.sessionStart;
	var tasksToWorkOnHash = _convo$sessionStart2.tasksToWorkOnHash;
	var dailyTasks = _convo$sessionStart2.dailyTasks;

	var SlackUserId = response.user;

	console.log("convo sessino start:");
	console.log(convo.sessionStart);

	var totalMinutes = 0;
	for (var key in tasksToWorkOnHash) {
		var _task = tasksToWorkOnHash[key];
		console.log("this specific daily task:");
		console.log(_task);
		var minutes = _task.dataValues.minutes;

		totalMinutes += parseInt(minutes);
	}

	var now = (0, _momentTimezone2.default)();
	var calculatedTimeObject = now.add(totalMinutes, 'minutes');
	var calculatedTimeString = calculatedTimeObject.format("h:mm a");
	convo.say('Nice! That should take until ' + calculatedTimeString + ' based on your estimate');
	convo.ask('Would you like to work until ' + calculatedTimeString + '?', [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {

			// success! now save session time info for the user
			convo.sessionStart.totalMinutes = totalMinutes;
			convo.sessionStart.calculatedTime = calculatedTimeString;
			convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

			askForCheckIn(response, convo);
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			askForCustomTotalMinutes(response, convo);
			convo.next();
		}
	}]);

	if (false) {
		/**
   * 		We may need to do something like this if Node / Sequelize
   * 		does not handle west coast as I idealistically hope for
   */

		// get timezone of user before continuing
		bot.api.users.list({
			presence: 1
		}, function (err, response) {
			var members = response.members; // members are all users registered to your bot

			for (var i = 0; i < members.length; i++) {
				if (members[i].id == SlackUserId) {
					var timeZoneObject = {};
					timeZoneObject.tz = members[i].tz;
					timeZoneObject.tz_label = members[i].tz_label;
					timeZoneObject.tz_offset = members[i].tz_offset;
					convo.sessionStart.timeZone = timeZoneObject;
					break;
				}
			}

			var timeZone = convo.sessionStart.timeZone;

			if (timeZone && timeZone.tz) {
				timeZone = timeZone.tz;
			} else {
				timeZone = "America/New_York"; // THIS IS WRONG AND MUST BE FIXED
				// SOLUTION IS MOST LIKELY TO ASK USER HERE WHAT THEIR TIMEZONE IS.
			}
		});
	}
}

// ask for custom amount of time to work on
function askForCustomTotalMinutes(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	convo.ask("What time would you like to work until? You can also tell me the duration you'd like to work, like `55 minutes` :upside_down_face:", function (response, convo) {
		var entities = response.intentObject.entities;
		// for time to tasks, these wit intents are the only ones that makes sense

		if (entities.duration || entities.custom_time) {
			confirmCustomTotalMinutes(response, convo);
		} else {
			// invalid
			convo.say("I'm sorry, I didn't catch that :dog:");
			convo.repeat();
		}

		convo.next();
	});
};

function confirmCustomTotalMinutes(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	var tz = convo.sessionStart.timeZone.tz;

	// use Wit to understand the message in natural language!

	var entities = response.intentObject.entities;

	var customTimeObject; // moment object of time
	var customTimeString; // format to display (`h:mm a`)
	var customTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
	if (entities.duration) {

		var durationArray = entities.duration;
		var durationSeconds = 0;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);

		// add minutes to now
		customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(durationSeconds, 'seconds');
		customTimeString = customTimeObject.format("h:mm a");
	} else if (entities.custom_time) {
		// get rid of timezone to make it tz-neutral
		// then create a moment-timezone object with specified timezone
		var timeStamp = entities.custom_time[0].value;

		// create time object based on user input + timezone
		customTimeObject = (0, _miscHelpers.createMomentObjectWithSpecificTimeZone)(timeStamp, tz);
		customTimeString = customTimeObject.format("h:mm a");
	}

	convo.ask('So you\'d like to work until ' + customTimeString + '?', [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {

			var now = (0, _momentTimezone2.default)();
			var minutesDuration = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

			// success! now save session time info for the user
			convo.sessionStart.totalMinutes = minutesDuration;
			convo.sessionStart.calculatedTime = customTimeString;
			convo.sessionStart.calculatedTimeObject = customTimeObject;

			askForCheckIn(response, convo);
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.ask("Yikes, my bad. Let's try this again. Just tell me how many minutes (`ex. 45 min`) or until what time (`ex. 3:15pm`) you'd like to work right now", function (response, convo) {
				confirmCustomTotalMinutes(response, convo);
				convo.next();
			});
			convo.next();
		}
	}]);
}

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	convo.ask("Boom :boom: Would you like me to check in with you during this session to make sure you're on track?", [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {
			convo.say("Sure thing! Let me know what time you want me to check in with you");
			convo.ask("I can also check in a certain number of minutes or hours from now, like `40 minutes` or `1 hour`", function (response, convo) {
				var entities = response.intentObject.entities;
				// for time to tasks, these wit intents are the only ones that makes sense

				if (entities.duration || entities.custom_time) {
					confirmCheckInTime(response, convo);
				} else {
					// invalid
					convo.say("I'm sorry, I didn't catch that :dog:");
					convo.say("Please put either a time like `2:41pm`, or a number of minutes or hours like `35 minutes`");
					convo.silentRepeat();
				}

				convo.next();
			}, { 'key': 'respondTime' });
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.next();
		}
	}]);
}

// confirm check in time with user
function confirmCheckInTime(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;
	var now = (0, _momentTimezone2.default)();

	// use Wit to understand the message in natural language!
	var entities = response.intentObject.entities;

	var checkinTimeObject; // moment object of time
	var checkinTimeString; // format to display (`h:mm a`)
	var checkinTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
	if (entities.duration) {

		var durationArray = entities.duration;
		var durationSeconds = 0;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);

		// add minutes to now
		checkinTimeObject = (0, _momentTimezone2.default)().add(durationSeconds, 'seconds');
		checkinTimeString = checkinTimeObject.format("h:mm a");
	} else if (entities.custom_time) {
		// get rid of timezone to make it tz-neutral
		// then create a moment-timezone object with specified timezone
		var timeStamp = entities.custom_time[0].value;
		timeStamp = (0, _momentTimezone2.default)(timeStamp); // in PST because of Wit default settings

		timeStamp.add(timeStamp._tzm - now.utcOffset(), 'minutes');
		// create time object based on user input + timezone

		checkinTimeObject = timeStamp;
		checkinTimeString = checkinTimeObject.format("h:mm a");
	}

	convo.ask('I\'ll be checking in with you at ' + checkinTimeString + '. Is that correct?', [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {

			var now = (0, _momentTimezone2.default)();
			var minutesDuration = Math.round(_momentTimezone2.default.duration(checkinTimeObject.diff(now)).asMinutes());

			// success! now save checkin time info for the user
			convo.sessionStart.checkinTimeObject = checkinTimeObject;
			convo.sessionStart.checkinTimeString = checkinTimeString;

			askForReminderDuringCheckin(response, convo);
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.say('Let\'s rewind :vhs: :rewind:');
			convo.ask("What time would you like me to check in with you? Just tell me a time or a certain number of minutes from the start of your session you'd like me to check in", function (response, convo) {
				confirmCheckInTime(response, convo);
				convo.next();
			});
			convo.next();
		}
	}]);
}

function askForReminderDuringCheckin(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	convo.say("Last thing - is there anything you'd like me to remind you during the check in?");
	convo.ask("This could be a note like `call Eileen` or `should be on the second section of the proposal by now`", [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {
			convo.ask('What note would you like me to remind you about?', function (response, convo) {
				getReminderNoteFromUser(response, convo);
				convo.next();
			});

			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			// we are assuming anything else is the reminderNote
			getReminderNoteFromUser(response, convo);
			convo.next();
		}
	}], { 'key': 'reminderNote' });
}

function getReminderNoteFromUser(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	var note = response.text;

	var _convo$sessionStart3 = convo.sessionStart;
	var checkinTimeObject = _convo$sessionStart3.checkinTimeObject;
	var checkinTimeString = _convo$sessionStart3.checkinTimeString;


	convo.ask('Does this look good: `' + note + '`?', [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {

			convo.sessionStart.reminderNote = note;
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.ask('Just tell me a one-line note and I\'ll remind you about it at ' + checkinTimeString + '!', function (response, convo) {
				getReminderNoteFromUser(response, convo);
				convo.next();
			});
			convo.next();
		}
	}]);
}
//# sourceMappingURL=startWorkSession.js.map