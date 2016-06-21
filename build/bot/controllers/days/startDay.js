'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.EXIT_EARLY_WORDS = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.default = function (controller) {

	// programmatic trigger of actual day start flow: `begin_day_flow`
	controller.on('trigger_day_start', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		controller.trigger('user_confirm_new_day', [bot, { SlackUserId: SlackUserId }]);
	});

	/**
  * 		User directly asks to start day
  * 				~* via Wit *~
  * 			confirm for `begin_day_flow`
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
				controller.trigger('user_confirm_new_day', [bot, { SlackUserId: SlackUserId }]);

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.config = { SlackUserId: SlackUserId };
					var name = user.nickName || user.email;
					convo.say('Hey, ' + name + '!');
					convo.on('end', function (convo) {
						console.log(convo);
						var SlackUserId = convo.config.SlackUserId;
					});
				});
			});
		}, 1000);
	});

	/**
  * 			User confirms he is wanting to
  * 					start his day. confirmation
  * 				needed every time b/c this resets everything
  */

	controller.on('user_confirm_new_day', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var name = user.nickName || user.email;
				convo.name = name;
				convo.readyToStartDay = false;

				convo.ask('Would you like to start your day?', [{
					pattern: bot.utterances.yes,
					callback: function callback(response, convo) {
						convo.say("Let's do it! :car: :dash:");
						convo.readyToStartDay = true;
						convo.next();
					}
				}, {
					pattern: bot.utterances.no,
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
					}
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

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var name = user.nickName || user.email;
				convo.name = name;

				convo.dayStart = {
					UserId: user.id,
					startDayDecision: false // what does user want to do with day
				};

				// start the flow
				askForDayTasks(err, convo);

				// on finish conversation
				convo.on('end', function (convo) {

					var responses = convo.extractResponses();
					var dayStart = convo.dayStart;


					console.log('done!');
					console.log("here is day start object:\n\n\n");
					console.log(convo.dayStart);
					console.log("\n\n\n");

					if (convo.status == 'completed') {
						var _ret = function () {
							var UserId = dayStart.UserId;
							var prioritizedTaskArray = dayStart.prioritizedTaskArray;

							// log `start_work` in SessionGroups
							// and all other relevant DB inserts

							_models2.default.SessionGroup.create({
								type: "start_work",
								UserId: UserId
							}).then(function (sessionGroup) {

								// make all pending tasks => archived, then all live tasks => pending
								// BEFORE the newly created start SessionGroup
								user.getDailyTasks({
									where: ['"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?', sessionGroup.createdAt, "pending"]
								}).then(function (dailyTasks) {
									dailyTasks.forEach(function (dailyTask) {
										dailyTask.update({
											type: "archived"
										});
									});
									user.getDailyTasks({
										where: ['"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?', sessionGroup.createdAt, "live"]
									}).then(function (dailyTasks) {

										dailyTasks.forEach(function (dailyTask) {
											dailyTask.update({
												type: "pending"
											});
										});

										// After all of the previous tasks have been put into "pending", choose the select ones and bring them back to "live"
										prioritizedTaskArray.forEach(function (task, index) {
											var text = task.text;
											var minutes = task.minutes;

											var priority = index + 1;
											_models2.default.Task.create({
												text: text
											}).then(function (task) {
												_models2.default.DailyTask.create({
													TaskId: task.id,
													priority: priority,
													minutes: minutes,
													UserId: UserId
												});
												// THIS IS WHERE YOU WILL UPDATE THE PREVIOUS DAY'S PENDING TASKS
											});
										});
									});
								});
							});

							// TRIGGER SESSION_START HERE
							if (dayStart.startDayDecision == _intents2.default.START_SESSION) {
								controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
								return {
									v: void 0
								};
							}
						}();

						if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
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
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EXIT_EARLY_WORDS = exports.EXIT_EARLY_WORDS = ['exit', 'stop', 'never mind', 'quit'];

// base controller for start day
;

// user just started conersation and is entering tasks
function askForDayTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;


	console.log("in ask for day tasks");;
	console.log(convo.name);

	convo.say('What tasks would you like to work on today? :pencil: You can enter everything in one line separated by commas, or send me each task in a separate line');
	convo.ask('Then just tell me when you\'re done by saying `' + _constants.FINISH_WORD.word + '`', function (response, convo) {

		for (var i = 0; i < EXIT_EARLY_WORDS.length; i++) {
			console.log('in exit early words loop! ' + EXIT_EARLY_WORDS[i]);
			if (response.text == EXIT_EARLY_WORDS[i]) convo.stop();
		}

		console.log('response is');
		console.log(response);

		if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
			convo.say("Awesome! You can always add more tasks later by telling me, `I'd like to add a task` or something along those lines :grinning:");
			displayTaskList(response, convo);
			convo.next();
		}
	}, { 'key': 'tasks', 'multiple': true });
}

// user has just entered his tasks for us to display back
function displayTaskList(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var tasks = convo.responses.tasks;


	var tasks = convo.responses.tasks;
	var taskArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(tasks);

	// taskArray is now attached to convo
	convo.dayStart.taskArray = taskArray;

	console.log("TASKS:");
	console.log(taskArray);

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray);

	// we need to prioritize the task list here to display to user
	convo.say('Now, please rank your tasks in order of your priorities today');
	convo.say(taskListMessage);
	convo.ask('You can just list the numbers, like `3, 4, 1, 2, 5`', function (response, convo) {
		prioritizeTaskList(response, convo);
		convo.next();
	}, { 'key': 'taskPriorities' });
}

// user has listed `5, 4, 2, 1, 3` for priorities to handle here
function prioritizeTaskList(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	// organize the task list!

	var taskArray = convo.dayStart.taskArray;

	// get user priority order (`1,4,3,2`), convert it to an array of ints, and use that to prioritize your array

	var initialPriorityOrder = response.text;

	// either a non-number, or number > length of tasks
	var isInvalid = false;
	var nonNumberTest = new RegExp(/\D/);
	initialPriorityOrder = initialPriorityOrder.split(",").map(function (order) {
		order = order.trim();
		var orderNumber = parseInt(order);
		if (nonNumberTest.test(order) || orderNumber > taskArray.length) isInvalid = true;
		return orderNumber;
	});

	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		displayTaskList(response, convo);
		return;
	}

	var priorityOrder = [];
	initialPriorityOrder.forEach(function (order) {
		if (order > 0) {
			order--; // make user-entered numbers 0-index based
			priorityOrder.push(order);
		}
	});

	var prioritizedTaskArray = [];
	priorityOrder.forEach(function (order) {
		prioritizedTaskArray.push(taskArray[order]);
	});

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTaskArray);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {
			convo.say("Excellent! Last thing: how much time would you like to allocate to each task today?");
			convo.say(taskListMessage);
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {

			convo.say("Whoops :banana: Let's try to do this again");
			displayTaskList(response, convo);
			convo.next();
		}
	}], { 'key': 'confirmedRightPriority' });
}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {
	convo.ask('Just say, `30, 40, 1 hour, 1hr 10 min, 15m` in order and I\'ll figure it out and assign those times to the tasks above :smiley:', function (response, convo) {
		assignTimeToTasks(response, convo);
		convo.next();
	}, { 'key': 'timeToTasksResponse' });
}

// this is the work we do to actually assign time to tasks
function assignTimeToTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var prioritizedTaskArray = convo.dayStart.prioritizedTaskArray;


	var timeToTask = response.text;

	// need to check for invalid responses.
	// does not say minutes or hours, or is not right length
	var isInvalid = false;
	timeToTask = timeToTask.split(",");
	if (timeToTask.length != prioritizedTaskArray.length) {
		isInvalid = true;
	};

	var validMinutesTester = new RegExp(/[\dh]/);
	timeToTask = timeToTask.map(function (time) {
		if (!validMinutesTester.test(time)) {
			isInvalid = true;
		}
		var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
		return minutes;
	});

	prioritizedTaskArray = prioritizedTaskArray.map(function (task, index) {
		return _extends({}, task, {
			minutes: timeToTask[index]
		});
	});

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTaskArray);

	// INVALID tester
	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid times :thinking_face:. Let's try this again");
		convo.say("Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
		convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`");
		convo.say(taskListMessage);
		getTimeToTasks(response, convo);
		return;
	}

	convo.say("Are these times right?");
	convo.ask(taskListMessage, [{
		pattern: bot.utterances.yes,
		callback: function callback(response, convo) {
			convo.say("Boom! This looks great");
			convo.ask("Ready to start your first focused work session today?", [{
				pattern: bot.utterances.yes,
				callback: function callback(response, convo) {
					convo.dayStart.startDayDecision = _intents2.default.START_SESSION;
					convo.next();
				}
			}, {
				pattern: bot.utterances.no,
				callback: function callback(response, convo) {
					convo.say("Great! Let me know when you're ready to start");
					convo.say("Alternatively, you can ask me to `remind` you to start at a specific time, like `remind me to start at 10am` or a relative time like `remind me in 10 minutes`");
					convo.next();
				}
			}], { 'key': 'startFirstSession' });
			convo.next();
		}
	}, {
		pattern: bot.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Let's give this another try :repeat_one:");
			convo.say("Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
			convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`");
			convo.ask(taskListMessage, function (response, convo) {
				assignTimeToTasks(response, convo);
				convo.next();
			});
			convo.next();
		}
	}]);
}
//# sourceMappingURL=startDay.js.map