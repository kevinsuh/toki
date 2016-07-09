'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// base controller for tasks


exports.default = function (controller) {

	/**
  * 		User wants to add task
  * 			as interpreted by ~ Wit.ai ~
  */
	controller.hears(['add_daily_task'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var intent = _intents2.default.ADD_TASK;
		var channel = message.channel;

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
  * 			ADD DAILY TASK FLOW
  */
	controller.on('add_task_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		// find user then get tasks

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// we need user's task lists since start_day
			var UserId = user.id;

			user.getSessionGroups({
				order: '"SessionGroup"."createdAt" DESC',
				limit: 1
			}).then(function (sessionGroups) {

				// should start day
				var startSessionGroup = sessionGroups[0]; // the start day

				user.getDailyTasks({
					where: ['"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?', startSessionGroup.dataValues.createdAt, false, "live"],
					include: [_models2.default.Task],
					order: '"DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					var name = user.nickName || user.email;
					var SlackUserId = user.SlackUser.SlackUserId;

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						convo.name = name;
						convo.tasksAdd = {
							SlackUserId: SlackUserId
						};

						dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
						convo.tasksAdd.dailyTasks = dailyTasks;

						askForNewTasksToAdd(err, convo);

						// on finish conversation
						convo.on('end', function (convo) {

							console.log("\n\n\n\n ~~ convo ended in add tasks ~~ \n\n\n\n");

							var responses = convo.extractResponses();
							var tasksAdd = convo.tasksAdd;


							if (convo.status == 'completed') {

								// prioritized task array is the one we're ultimately going with
								var _dailyTasks = tasksAdd.dailyTasks;
								var prioritizedTaskArray = tasksAdd.prioritizedTaskArray;

								// we're going to archive all existing daily tasks first by default, then re-update the ones that matter

								_dailyTasks.forEach(function (dailyTask) {
									var id = dailyTask.dataValues.id;

									console.log('\n\n\nupdating daily task id: ' + id + '\n\n\n');
									_models2.default.DailyTask.update({
										type: "archived"
									}, {
										where: { id: id }
									});
								});

								// store the user's tasks
								// existing dailyTasks: update to new obj (esp. `priority`)
								// new dailyTasks: create new obj
								prioritizedTaskArray.forEach(function (dailyTask, index) {
									var dataValues = dailyTask.dataValues;

									var newPriority = index + 1;

									if (dataValues) {

										console.log("\n\nexisting daily task:\n\n\n");
										console.log(dailyTask.dataValues);
										console.log('user id: ' + UserId);
										console.log("\n\n\n\n");

										// existing daily task and make it live
										var id = dataValues.id;
										var minutes = dataValues.minutes;

										_models2.default.DailyTask.update({
											minutes: minutes,
											UserId: UserId,
											priority: newPriority,
											type: "live"
										}, {
											where: { id: id }
										});
									} else {
										(function () {

											console.log("\n\n new daily task:\n\n\n");
											console.log(dailyTask);
											console.log('user id: ' + UserId);
											console.log("\n\n\n\n");

											// new task
											var text = dailyTask.text;
											var minutes = dailyTask.minutes;

											_models2.default.Task.create({
												text: text
											}).then(function (task) {
												_models2.default.DailyTask.create({
													TaskId: task.id,
													priority: newPriority,
													minutes: minutes,
													UserId: UserId
												});
											});
										})();
									}
								});
							} else {

								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
									convo.say("Okay! I didn't add any tasks. I'll be here whenever you want to do that :smile:");
									convo.next();
								});
							}
						});
					});
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

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _botResponses = require('../../lib/botResponses');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// user adds new tasks here
function askForNewTasksToAdd(response, convo) {
	var task = convo.task;
	var name = convo.name;
	var bot = task.bot;
	var source_message = task.source_message;
	var dailyTasks = convo.tasksAdd.dailyTasks;


	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	if (dailyTasks.length > 0) {
		convo.say('Here are the tasks you outlined so far:');
		convo.say(taskListMessage);
	}

	convo.say('What task(s) would you like to add to your list? :pencil:');
	convo.say('You can enter everything in one line, separated by commas, or send me each task in a separate line');

	convo.ask('Then just tell me when you\'re done by saying `' + _constants.FINISH_WORD.word + '`!', function (response, convo) {

		if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
			askForTimeToTasks(response, convo);
			convo.next();
		}
	}, { 'key': 'newTasks', 'multiple': true });
}

// ask user to put time to tasks
function askForTimeToTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var newTasks = convo.responses.newTasks;


	var newTasksArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(newTasks);

	// if no tasks added, quit!
	if (newTasksArray.length == 0) {
		convo.stop();
		convo.next();
		return;
	}

	convo.tasksAdd.newTasksArray = newTasksArray;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasksArray);

	convo.say('Excellent! Now, how much time would you like to allocate to these new tasks today?');
	convo.say(taskListMessage);
	getTimeToTasks(response, convo);
}

// actual question for user to give time to tasks
function getTimeToTasks(response, convo) {
	convo.ask("Just say, `30, 40, 50, 1 hour, 15 min` and I'll figure it out and assign those times to the tasks above in order :smiley:", function (response, convo) {
		assignTimeToTasks(response, convo);
		convo.next();
	});
}

// actual work of assigning user response times to task
function assignTimeToTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var newTasksArray = convo.tasksAdd.newTasksArray;


	var timeToTask = response.text;

	// need to check for invalid responses.
	// does not say minutes or hours, or is not right length
	var isInvalid = false;
	timeToTask = timeToTask.split(",");
	if (timeToTask.length != newTasksArray.length) {
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

	newTasksArray = newTasksArray.map(function (task, index) {
		return _extends({}, task, {
			minutes: timeToTask[index]
		});
	});

	convo.tasksAdd.newTasksArray = newTasksArray;
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasksArray);

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
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say('This looks great. Let\'s add these to your existing list now');
			askToPrioritizeList(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say('Let\'s give this another try :repeat_one:');
			convo.say(taskListMessage);
			convo.say('Send me the amount of time you\'d like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on');
			convo.ask("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`", function (response, convo) {
				assignTimeToTasks(response, convo);
				convo.next();
			});
			convo.next();
		}
	}]);
}

// ask to prioritize task list. all existing daily tasks and new ones
function askToPrioritizeList(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	// organize the task lists!

	var _convo$tasksAdd = convo.tasksAdd;
	var dailyTasks = _convo$tasksAdd.dailyTasks;
	var newTasksArray = _convo$tasksAdd.newTasksArray;

	var allTasksArray = dailyTasks.slice();
	newTasksArray.forEach(function (newTask) {
		allTasksArray.push(newTask);
	});
	convo.tasksAdd.allTasksArray = allTasksArray;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(allTasksArray);
	convo.say("Please rank your tasks in order of your priorities today");
	convo.say(taskListMessage);
	convo.ask("You can just like the numbers, like `3, 4, 1, 2, 5`", function (response, convo) {
		prioritizeTaskList(response, convo);
		convo.next();
	});
}

// assign the priorities to full task list
// user has just listed `1, 3, 4, 2`
function prioritizeTaskList(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	// organize the task lists!

	var _convo$tasksAdd2 = convo.tasksAdd;
	var dailyTasks = _convo$tasksAdd2.dailyTasks;
	var newTasksArray = _convo$tasksAdd2.newTasksArray;
	var allTasksArray = _convo$tasksAdd2.allTasksArray;

	var allTasksArray = dailyTasks.slice();
	newTasksArray.forEach(function (newTask) {
		allTasksArray.push(newTask);
	});

	// get tasks from array
	var userInput = response.text; // i.e. `1, 3, 4, 2`
	var prioritizedTaskArray = (0, _messageHelpers.prioritizeTaskArrayFromUserInput)(allTasksArray, userInput);

	// means user input is invalid
	if (!prioritizedTaskArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		askToPrioritizeList(response, convo);
		return;
	}

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTaskArray);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			convo.tasksAdd.prioritizedTaskArray = prioritizedTaskArray;
			var SlackUserId = convo.tasksAdd.SlackUserId;


			convo.say("Boom! This looks great");

			// if user has no work sessions started, encourage user to start a session
			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {
				user.getWorkSessions({
					where: ['"open" = ?', true]
				}).then(function (workSessions) {
					// user should start a session!
					if (workSessions.length == 0) {
						convo.say("Let me know when you're ready to `start a session` :smile_cat:");
					} else {
						// user was just adding tasks in the middle of a session
						convo.say("Let’s get back to it. Good luck finishing the session :fist:");
					}
					convo.next();
				});
			});
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Whoops :banana: Let's try to do this again");
			askToPrioritizeList(response, convo);
			convo.next();
		}
	}]);
}
//# sourceMappingURL=add.js.map