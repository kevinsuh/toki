'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startNewPlanFlow = startNewPlanFlow;

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

var _constants = require('../../lib/constants');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		NEW PLAN CONVERSATION FLOW FUNCTIONS
 */

function startNewPlanFlow(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan = convo.newPlan;
	var SlackUserId = _convo$newPlan.SlackUserId;
	var daySplit = _convo$newPlan.daySplit;
	var onboardVersion = _convo$newPlan.onboardVersion;

	convo.newPlan.prioritizedTasks = [];

	var contextDay = "today";
	if (daySplit != _constants.constants.MORNING.word) {
		contextDay = 'this ' + daySplit;
	}

	var question = 'Let’s win ' + contextDay + '! What are up to 3 priorities you want to work toward today? These are the important outcomes that you want to put time toward achieving today, not necessarily specific tasks you want to check off your todo list';
	if (onboardVersion) {
		question = question + ' Please enter each one in a separate message';
	}

	addPriorityToList(convo);
}

// function to add a priority to your plan
// this dynamically handles 1st, 2nd, 3rd priorities
function addPriorityToList(convo) {
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var count = prioritizedTasks.length;
	var countString = '';
	var actions = [];

	switch (count) {
		case 0:
			countString = 'first';
			break;
		case 1:
			countString = 'second';
			actions = [{
				name: _constants.buttonValues.newPlan.noMorePriorities.name,
				text: "No more priorities",
				value: _constants.buttonValues.newPlan.noMorePriorities.value,
				type: "button"
			}, {
				name: _constants.buttonValues.newPlan.redoLastPriority.name,
				text: "Redo last priority",
				value: _constants.buttonValues.newPlan.redoLastPriority.value,
				type: "button"
			}];
			break;
		case 2:
			countString = 'third';
			actions = [{
				name: _constants.buttonValues.newPlan.noMorePriorities.name,
				text: "No more priorities",
				value: _constants.buttonValues.newPlan.noMorePriorities.value,
				type: "button"
			}, {
				name: _constants.buttonValues.newPlan.redoLastPriority.name,
				text: "Redo last priority",
				value: _constants.buttonValues.newPlan.redoLastPriority.value,
				type: "button"
			}];
			break;
		default:
			break;
	};

	var attachments = [{
		attachment_type: 'default',
		callback_id: "ADD_PRIORITY",
		fallback: "Do you want to add another priority?",
		color: _constants.colorsHash.grey.hex,
		actions: actions
	}];
	var message = 'What is the ' + countString + ' priority you want to work towards today?';

	convo.ask({
		text: message,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.redo,
		callback: function callback(response, convo) {

			if (prioritizedTasks.length > 0) {
				var task = prioritizedTasks.pop();
				convo.say('Okay! I removed `' + task.text + '` from your list');
			}
			convo.newPlan.prioritizedTasks = prioritizedTasks;
			addPriorityToList(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noMore,
		callback: function callback(response, convo) {

			includeTeamMembers(convo);
			convo.next();
		}
	}, { // this is additional task added in this case.
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};
			prioritizedTasks.push(newTask);

			var approvalWord = (0, _messageHelpers.getRandomApprovalWord)({ upperCase: true });
			var message = approvalWord + '! I added `' + newTask.text + '`';
			if (prioritizedTasks.length % 2 == 0) {
				message = message + ' to your plan';
			}
			convo.say(message);

			convo.newPlan.prioritizedTasks = prioritizedTasks;

			if (prioritizedTasks.length >= 3) {
				includeTeamMembers(convo);
			} else {
				// ask again!
				addPriorityToList(convo);
			}

			convo.next();
		}
	}]);
}

function includeTeamMembers(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan2 = convo.newPlan;
	var SlackUserId = _convo$newPlan2.SlackUserId;
	var daySplit = _convo$newPlan2.daySplit;
	var onboardVersion = _convo$newPlan2.onboardVersion;
	var includeTeamMembers = _convo$newPlan2.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTasks, options);

	convo.say('Now let’s view your plan for today :pencil::\n' + taskListMessage);

	// say who is getting included
	_models2.default.SlackUser.find({
		where: ['"SlackUserId" = ?', SlackUserId]
	}).then(function (slackUser) {

		var responseMessage = 'Excellent!';

		if (slackUser) {

			slackUser.getIncluded({
				include: [_models2.default.User]
			}).then(function (includedSlackUsers) {

				if (includedSlackUsers.length > 0) {

					// user has team members to include!!
					var names = includedSlackUsers.map(function (includedSlackUser) {
						return includedSlackUser.dataValues.User.nickName;
					});
					var nameStrings = (0, _messageHelpers.commaSeparateOutTaskArray)(names);
					responseMessage = 'I\'ll be sharing your plan with *' + nameStrings + '* when you\'re done :raised_hands:';
					convo.say(responseMessage);
				} else if (includeTeamMembers) {

					// user wants to include members!!!
					askToIncludeTeamMembers(convo);
				} else {

					// user does not want to include members

					convo.say(responseMessage);
					chooseFirstTask(convo);
					convo.next();
				}
			});
		} else {

			convo.say(responseMessage);
			chooseFirstTask(convo);
			convo.next();
		}
	});
}

function askToIncludeTeamMembers(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan3 = convo.newPlan;
	var SlackUserId = _convo$newPlan3.SlackUserId;
	var daySplit = _convo$newPlan3.daySplit;
	var onboardVersion = _convo$newPlan3.onboardVersion;
	var includeTeamMembers = _convo$newPlan3.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var message = 'Would you like to share your plan with a colleague? *Just mention a Slack username* like `@emily` and I’ll share your priorities with them';

	if (onboardVersion) {
		convo.say(message);
		message = 'This makes it easy to communicate your outcomes for today, and make sure that you\'re working on the highest priority items for yourself and your team';
	};

	var attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.notToday.name,
			text: "Not today!",
			value: _constants.buttonValues.notToday.value,
			type: "button"
		}, {
			name: _constants.buttonValues.newPlan.noMorePriorities.name,
			text: "No - dont ask again",
			value: _constants.buttonValues.newPlan.noMorePriorities.value,
			type: "button"
		}, {
			name: _constants.buttonValues.newPlan.redoLastPriority.name,
			text: "Redo last priority",
			value: _constants.buttonValues.newPlan.redoLastPriority.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: message,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.notToday,
		callback: function callback(response, convo) {

			convo.say('Okay! Let\'s not include anyone for today');
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noDontAskAgain,
		callback: function callback(response, convo) {

			convo.newPlan.dontIncludeAnyonePermanent = true;
			convo.say('No worries! I won’t ask again. You can add someone to receive your priorities when you make them by saying `show settings`');
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.redo,
		callback: function callback(response, convo) {

			if (prioritizedTasks.length > 0) {
				var task = prioritizedTasks.pop();
				convo.say('Okay! I removed `' + task.text + '` from your list');
			}
			convo.newPlan.prioritizedTasks = prioritizedTasks;
			addPriorityToList(convo);
			convo.next();
		}
	}, { // this is additional task added in this case.
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;


			var includeSlackUserIds = (0, _miscHelpers.getSlackUsersFromString)(text);

			if (includeSlackUserIds) {
				_models2.default.SlackUser.findAll({
					where: ['"SlackUser"."SlackUserId" IN (?)', includeSlackUserIds],
					include: [_models2.default.User]
				}).then(function (slackUsers) {

					var userNames = slackUsers.map(function (slackUser) {
						return slackUser.dataValues.User.nickName;
					});
					var finalSlackUserIdsToInclude = slackUsers.map(function (slackUser) {
						return slackUser.dataValues.SlackUserId;
					});

					convo.newPlan.includeSlackUserIds = finalSlackUserIdsToInclude;
					var userNameStrings = (0, _messageHelpers.commaSeparateOutTaskArray)(userNames);

					convo.say('Great! After planning, I\'ll let *' + userNameStrings + '*  know that you’ll be focused on these priorities today');
					convo.say("You can add someone to receive your priorities automatically when you make them each morning by saying `show settings`");
					convo.next();
				});
			} else {

				convo.say("You didn't include any users! I pick up who you want to include by their slack handles, like `@fulton`");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}

function chooseFirstTask(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var bot = convo.task.bot;
	var _convo$newPlan4 = convo.newPlan;
	var daySplit = _convo$newPlan4.daySplit;
	var onboardVersion = _convo$newPlan4.onboardVersion;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	if (question == '') // this is the default question!
		question = 'Which of your ' + prioritizedTasks.length + ' priorities do you want to work on first?';

	if (prioritizedTasks.length == 1) {
		// no need to choose if 1 task
		convo.newPlan.startTask.index = 0;
		getTimeToTask(convo);
	} else {

		// 2+ tasks means choosing one
		var options = { dontShowMinutes: true, dontCalculateMinutes: true };
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTasks, options);

		convo.ask({
			text: question + '\n' + taskListMessage,
			attachments: [{
				attachment_type: 'default',
				callback_id: "REDO_TASKS",
				fallback: "Do you want to work on this task?",
				color: _constants.colorsHash.grey.hex,
				actions: [{
					name: _constants.buttonValues.redoMyPriorities.name,
					text: "Redo my priorities!",
					value: _constants.buttonValues.redoMyPriorities.value,
					type: "button"
				}]
			}]
		}, [{
			pattern: _botResponses.utterances.containsRedo,
			callback: function callback(response, convo) {

				convo.say("Okay! Let's try this again :repeat:");
				startNewPlanFlow(convo);
				convo.next();
			}
		}, {
			pattern: _botResponses.utterances.containsNumber,
			callback: function callback(response, convo) {

				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, prioritizedTasks);
				var taskIndexToWorkOn = taskNumbersToWorkOnArray[0] - 1;

				if (taskIndexToWorkOn >= 0) {
					if (taskNumbersToWorkOnArray.length == 1) {
						convo.newPlan.startTask.index = taskIndexToWorkOn;

						var taskString = prioritizedTasks[convo.newPlan.startTask.index].text;

						if (onboardVersion) {
							convo.say('Boom :boom:! Let\'s put our first focused work session towards `' + taskString + '`');
							convo.say('This isn\'t necessarily how long you think each task will take -- instead, think of it as dedicated time towards your most important things for the day. This structure helps you *enter flow* more easily, as well as *protect your time* from yourself and others');
							convo.say('If you aren\'t done with the task after your first session, you can easily start another one towards it :muscle:');
						} else {
							convo.say("Boom! Let's do it :boom:");
						}

						getTimeToTask(convo);
					} else {
						// only one at a time
						convo.say("Let's work on one priority at a time!");
						var _question = "Which one do you want to start with?";
						chooseFirstTask(convo, _question);
					}
				} else {
					convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
					var _question2 = "Which of these do you want to start off with?";
					chooseFirstTask(convo, _question2);
				}

				convo.next();
			}
		}, {
			default: true,
			callback: function callback(response, convo) {
				convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
				convo.repeat();
				convo.next();
			}
		}]);
	}
}

function getTimeToTask(convo) {
	var _convo$newPlan5 = convo.newPlan;
	var tz = _convo$newPlan5.tz;
	var daySplit = _convo$newPlan5.daySplit;
	var onboardVersion = _convo$newPlan5.onboardVersion;
	var startTask = _convo$newPlan5.startTask;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var taskString = prioritizedTasks[startTask.index].text;

	// not used right now
	var attachments = [];
	if (prioritizedTasks.length > 1) {
		attachments.push({
			attachment_type: 'default',
			callback_id: "CHANGE_TASK",
			fallback: "Do you want to work on a different task?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.workOnDifferentTask.name,
				text: "Different task instead",
				value: _constants.buttonValues.workOnDifferentTask.value,
				type: "button"
			}]
		});
	}

	var timeExample = (0, _momentTimezone2.default)().tz(tz).add(90, "minutes").format("h:mma");

	// we should have helper text here as well for the first time
	// push back on 90 / 60 / 30 here... should have higher minute intervals that we then automatically put in breaks for (we can communicate here)
	convo.ask({
		text: 'How much time do you want to allocate towards `' + taskString + '` today? (you can also say `for 90 minutes` or `until ' + timeExample + '`)',
		attachments: [{
			attachment_type: 'default',
			callback_id: "MINUTES_SUGGESTION",
			fallback: "How long do you want to work on this task for?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.workOnTaskFor.ninetyMinutes.name,
				text: "120 minutes",
				value: "120 minutes",
				type: "button"
			}, {
				name: _constants.buttonValues.workOnTaskFor.ninetyMinutes.name,
				text: "90 minutes",
				value: _constants.buttonValues.workOnTaskFor.ninetyMinutes.value,
				type: "button"
			}, {
				name: _constants.buttonValues.workOnTaskFor.sixtyMinutes.name,
				text: "60 minutes",
				value: _constants.buttonValues.workOnTaskFor.sixtyMinutes.value,
				type: "button"
			}, {
				name: _constants.buttonValues.workOnTaskFor.thirtyMinutes.name,
				text: "30 minutes",
				value: _constants.buttonValues.workOnTaskFor.thirtyMinutes.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.containsDifferent,
		callback: function callback(response, convo) {

			convo.say("Okay! Let's do a different task");
			var question = "What task do you want to start with instead?";
			chooseFirstTask(convo, question);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// use wit to decipher the relative time. if no time, then re-ask
			var _response$intentObjec = response.intentObject.entities;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);

			var minutes = 0;
			var now = (0, _momentTimezone2.default)();

			if (customTimeObject) {
				if (duration) {
					minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
				} else {
					minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				}
			}

			if (minutes > 0) {
				convo.say('Got it!');
				convo.newPlan.startTask.minutes = minutes;
				startOnTask(convo);
			} else {
				convo.say("Sorry, I didn't catch that. Let me know a time `i.e. 45 minutes`");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}

function startOnTask(convo) {
	var _convo$newPlan6 = convo.newPlan;
	var tz = _convo$newPlan6.tz;
	var daySplit = _convo$newPlan6.daySplit;
	var onboardVersion = _convo$newPlan6.onboardVersion;
	var startTask = _convo$newPlan6.startTask;
	var SlackUserId = _convo$newPlan6.SlackUserId;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var timeExample = (0, _momentTimezone2.default)().tz(tz).add(10, "minutes").format("h:mma");
	var taskString = prioritizedTasks[startTask.index].text;
	convo.ask({
		text: 'When do you want to get started on `' + taskString + '`? (you can also say `in 10 minutes` or `at ' + timeExample + '`)',
		attachments: [{
			attachment_type: 'default',
			callback_id: "DO_TASK_NOW",
			fallback: "Let's do it now!",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.startTaskIn.now.name,
				text: "Let's do it now!",
				value: _constants.buttonValues.startTaskIn.now.value,
				type: "button"
			}, {
				name: _constants.buttonValues.startTaskIn.tenMinutes.name,
				text: "In 10 minutes",
				value: _constants.buttonValues.startTaskIn.tenMinutes.value,
				type: "button"
			}]
		}] }, [{
		pattern: _botResponses.utterances.containsNow,
		callback: function callback(response, convo) {

			convo.say('You\'re crushing this ' + daySplit + ' :punch:');
			convo.newPlan.startNow = true;
			if (onboardVersion) {
				// whoDoYouWantToInclude(convo);
			}
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// use wit to decipher the relative time. if no time, then re-ask
			var _response$intentObjec2 = response.intentObject.entities;
			var duration = _response$intentObjec2.duration;
			var datetime = _response$intentObjec2.datetime;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);

			var minutes = void 0;
			var now = (0, _momentTimezone2.default)();
			if (customTimeObject) {

				convo.newPlan.startTime = customTimeObject;
				if (duration) {
					minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
				} else {
					minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				}
				var timeString = customTimeObject.format("h:mm a");
				convo.say('Okay! I\'ll see you at ' + timeString + ' to get started :timer_clock:');
				if (onboardVersion) {
					// whoDoYouWantToInclude(convo);
				}
				convo.next();
			} else {
				convo.say("Sorry, I didn't catch that. Let me know a time `i.e. let's start in 10 minutes`");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}

/**
 * 		IRRELEVANT FOR CURRENT INTERATION
 */
function prioritizeTasks(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var bot = convo.task.bot;
	var _convo$newPlan7 = convo.newPlan;
	var daySplit = _convo$newPlan7.daySplit;
	var onboardVersion = _convo$newPlan7.onboardVersion;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	if (question == '') // this is the default question!
		question = 'How would you rank your ' + prioritizedTasks.length + ' priorities in order of most meaningful to your day?';

	if (prioritizedTasks.length == 1) {
		// 1 task needs no prioritizing
		convo.newPlan.startTask.index = 0;
		getTimeToTask(convo);
	} else {
		// 2+ tasks need prioritizing
		var options = { dontShowMinutes: true, dontCalculateMinutes: true };
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTasks, options);

		convo.ask({
			text: question + '\n' + taskListMessage,
			attachments: [{
				attachment_type: 'default',
				callback_id: "KEEP_TASK_ORDER",
				fallback: "Let's keep this task order!",
				color: _constants.colorsHash.grey.hex,
				actions: [{
					name: _constants.buttonValues.keepTaskOrder.name,
					text: "Keep this order!",
					value: _constants.buttonValues.keepTaskOrder.value,
					type: "button"
				}]
			}]
		}, [{
			pattern: _botResponses.utterances.containsKeep,
			callback: function callback(response, convo) {

				convo.say("This order looks great to me, too!");
				convo.next();
			}
		}, {
			default: true,
			callback: function callback(response, convo) {

				console.log("\n\n keep stuff");
				console.log(response.text);

				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, prioritizedTasks);

				var necessaryNumbers = [];
				for (var i = 0; i < prioritizedTasks.length; i++) {
					var number = i + 1;
					necessaryNumbers.push(number);
				}

				var newPrioritizedTaskNumbers = taskNumbersToWorkOnArray.slice();
				// this tests if the arrays contain the same values or not
				if (taskNumbersToWorkOnArray.sort().join(',') === necessaryNumbers.sort().join(',')) {
					(function () {

						var newPrioritizedTasks = [];
						newPrioritizedTaskNumbers.forEach(function (taskNumber) {
							var index = taskNumber - 1;
							newPrioritizedTasks.push(prioritizedTasks[index]);
						});
						convo.newPlan.prioritizedTasks = newPrioritizedTasks;

						convo.say("Love it!");
						if (onboardVersion) {
							// whoDoYouWantToInclude(convo);
						}
					})();
				} else {

					necessaryNumbers.reverse();
					var numberString = necessaryNumbers.join(", ");
					convo.say("Sorry, I didn't catch that");
					var repeatQuestion = 'Let me know how you would rank your ' + prioritizedTasks.length + ' priorities in order of importance by listing the numbers `i.e. ' + numberString + '`';
					prioritizeTasks(convo, repeatQuestion);
				}

				convo.next();
			}
		}]);
	}
}
//# sourceMappingURL=plan.js.map