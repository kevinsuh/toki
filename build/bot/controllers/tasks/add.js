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

		var text = message.text;
		var _message$intentObject = message.intentObject.entities;
		var reminder = _message$intentObject.reminder;
		var duration = _message$intentObject.duration;


		var userMessage = {
			text: text,
			reminder: reminder,
			duration: duration
		};

		// if the user says tasks (plural), then assume
		// they want to add multiple tasks
		var tasksRegExp = new RegExp(/(\btasks\b)/i);
		if (tasksRegExp.test(text)) {
			intent = _intents2.default.EDIT_TASKS;
		}

		var config = {
			intent: intent,
			SlackUserId: SlackUserId,
			message: userMessage
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('new_session_group_decision', [bot, config]);
		}, 1000);

		(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
	});

	/**
  * 			ADD DAILY TASK FLOW
  */
	controller.on('add_task_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var message = config.message;


		(0, _miscHelpers.consoleLog)("in add task flow", message);

		// if has duration and/or reminder we can autofill
		var reminder = message.reminder;
		var duration = message.duration;

		var minutes = false;
		var task = false;

		// length of task
		if (duration) {
			minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
		}
		// content of task
		if (reminder) {
			task = reminder[0].value;
		}

		// find user then get tasks
		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;

			user.getSessionGroups({
				order: '"SessionGroup"."createdAt" DESC',
				limit: 1
			}).then(function (sessionGroups) {

				if (sessionGroups.length == 0 || sessionGroups[0].dataValues.type == "end_work") {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.say("Hey! You haven't `started a day` yet, let's do that first");
						convo.next();
					});
					return;
				}

				// should start day
				var startSessionGroup = sessionGroups[0];

				user.getDailyTasks({
					where: ['"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?', startSessionGroup.dataValues.createdAt, false, "live"],
					include: [_models2.default.Task],
					order: '"DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					var name = user.nickName || user.email;
					var SlackUserId = user.SlackUser.SlackUserId;

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						convo.tasksAdd = {
							SlackUserId: SlackUserId,
							minutes: minutes,
							task: task
						};

						getTaskContent(err, convo);

						// on finish conversation
						convo.on('end', function (convo) {
							var _convo$tasksAdd = convo.tasksAdd;
							var task = _convo$tasksAdd.task;
							var minutes = _convo$tasksAdd.minutes;
							var editTaskList = _convo$tasksAdd.editTaskList;


							if (convo.status == 'completed') {

								// if we have the task and minutes, let's add it
								if (task && minutes) {

									var newPriority = dailyTasks.length + 1;
									_models2.default.Task.create({
										text: task
									}).then(function (task) {
										_models2.default.DailyTask.create({
											TaskId: task.id,
											priority: newPriority,
											minutes: minutes,
											UserId: UserId
										}).then(function () {
											// if user added a task, then we need to edit task list flow after creation
											if (editTaskList) {
												controller.trigger('edit_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
											} else {
												controller.trigger('view_daily_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
											}
										});
									});
								} else {
									// if user did not add a task, then we can go straight to editing task list
									if (editTaskList) {
										controller.trigger('edit_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
									} else {
										(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
									}
								}
							} else {

								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
									convo.say("Okay! I didn't add any tasks. I'll be here whenever you want to do that :smile:");
									convo.next();
								});
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
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

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _botResponses = require('../../lib/botResponses');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

/**
 * 			~~ START OF SINGLE TASK ADD FLOW ~~
 */

function getTaskContent(response, convo) {
	var _convo$tasksAdd2 = convo.tasksAdd;
	var task = _convo$tasksAdd2.task;
	var minutes = _convo$tasksAdd2.minutes;


	if (task) {
		// task has been filled and we can move on

		// hack to handle wit problems
		if (!minutes && (_botResponses.utterances.containsTask.test(task) && task.length < 7 || _botResponses.utterances.startsWithAdd.test(task)) || _botResponses.utterances.containsAdd.test(task) && _botResponses.utterances.containsTask.test(task)) {
			askForTask(response, convo);
		} else {
			getTaskMinutes(response, convo);
		}
	} else {
		askForTask(response, convo);
	}
}

function askForTask(response, convo) {
	convo.ask('What is the task? `i.e. add email market report for 30 min`', function (response, convo) {
		var text = response.text;
		var entities = response.intentObject.entities;


		convo.tasksAdd.task = text;

		// shortcut add minutes if user uses single line
		// `i.e. email market report for 30 min`
		if (entities.duration && entities.reminder) {
			var minutes = (0, _miscHelpers.witDurationToMinutes)(entities.duration);
			var task = entities.reminder[0].value;
			convo.tasksAdd.minutes = minutes;
			convo.tasksAdd.task = task;
		}

		getTaskMinutes(response, convo);
		convo.next();
	});
}

function getTaskMinutes(response, convo) {
	var minutes = convo.tasksAdd.minutes;


	if (minutes) {
		// minutes has been filled and we can move on
		confirmTaskToAdd(response, convo);
	} else {
		convo.ask('How long will this task take?', function (response, convo) {
			var text = response.text;

			var validMinutesTester = new RegExp(/[\dh]/);
			if (validMinutesTester.test(text)) {
				var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(text);
				convo.tasksAdd.minutes = minutes;
				confirmTaskToAdd(response, convo);
			} else {
				convo.say("Oops, I didn't quite get that. Let me know duration like `30 min` or `1 hour`");
				convo.repeat();
			}
			convo.next();
		});
	}
}

// confirm here to add the task
function confirmTaskToAdd(response, convo) {
	var _convo$tasksAdd3 = convo.tasksAdd;
	var task = _convo$tasksAdd3.task;
	var minutes = _convo$tasksAdd3.minutes;

	var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

	convo.ask({
		text: 'Does this look good? If so, I\'ll add `' + task + ' (' + timeString + ')` to your tasks',
		attachments: [{
			attachment_type: 'default',
			callback_id: "CONFIRM_TASK_ADD",
			fallback: "Does this task look good?",
			actions: [{
				name: _constants.buttonValues.addTask.name,
				text: "Yes!",
				value: _constants.buttonValues.addTask.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.changeTaskContent.name,
				text: "Change task",
				value: _constants.buttonValues.changeTaskContent.value,
				type: "button"
			}, {
				name: _constants.buttonValues.changeTaskTime.name,
				text: "Change time",
				value: _constants.buttonValues.changeTaskTime.value,
				type: "button"
			}, {
				name: _constants.buttonValues.editTaskList.name,
				text: "Yes + View tasks",
				value: _constants.buttonValues.editTaskList.value,
				type: "button"
			}, {
				name: _constants.buttonValues.neverMind.name,
				text: "Never mind",
				value: _constants.buttonValues.neverMind.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.addTask.value,
		callback: function callback(response, convo) {
			convo.next();
		}
	}, { // NL equivalent to buttonValues.addTask.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say('Added! Keep at it :muscle:');
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeTaskContent.value,
		callback: function callback(response, convo) {
			convo.tasksAdd.task = false;
			getTaskContent(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeTaskContent.value
		pattern: _botResponses.utterances.containsChangeTask,
		callback: function callback(response, convo) {
			convo.say("Okay!");
			convo.tasksAdd.task = false;
			getTaskContent(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeTaskTime.value,
		callback: function callback(response, convo) {
			convo.tasksAdd.minutes = false;
			getTaskMinutes(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeTaskTime.value
		pattern: _botResponses.utterances.containsChangeTime,
		callback: function callback(response, convo) {
			convo.say("Okay!");
			convo.tasksAdd.minutes = false;
			getTaskMinutes(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.editTaskList.value,
		callback: function callback(response, convo) {
			convo.say("I added this task too :grin:");
			convo.tasksAdd.editTaskList = true;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.editTaskList.value
		pattern: _botResponses.utterances.containsEditTaskList,
		callback: function callback(response, convo) {
			convo.say("Okay! I added your task :grin:. Let's edit your task list");
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.neverMind.value,
		callback: function callback(response, convo) {
			convo.say("Let's back to it!");
			convo.tasksAdd.minutes = false;
			convo.tasksAdd.task = false;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.editTaskList.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay, I didn't add any tasks. Let's back to it!");
			convo.tasksAdd.minutes = false;
			convo.tasksAdd.task = false;
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
}

/**
 * 			~~ END OF SINGLE TASK ADD FLOW ~~
 */

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

	var _convo$tasksAdd4 = convo.tasksAdd;
	var dailyTasks = _convo$tasksAdd4.dailyTasks;
	var newTasksArray = _convo$tasksAdd4.newTasksArray;

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

	var _convo$tasksAdd5 = convo.tasksAdd;
	var dailyTasks = _convo$tasksAdd5.dailyTasks;
	var newTasksArray = _convo$tasksAdd5.newTasksArray;
	var allTasksArray = _convo$tasksAdd5.allTasksArray;

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
					where: ['"live" = ?', true]
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