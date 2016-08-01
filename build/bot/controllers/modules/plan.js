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
	var daySplit = _convo$newPlan.daySplit;
	var onboardVersion = _convo$newPlan.onboardVersion;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var contextDay = "today";
	if (daySplit != _constants.constants.MORNING.word) {
		contextDay = 'this ' + daySplit;
	}
	var question = 'What are the 3 outcomes you want to make happen ' + contextDay + '?';
	if (onboardVersion) {
		question = question + ' Please enter each one in a separate message';
	}

	prioritizedTasks = [];
	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = void 0;
	convo.ask({
		text: question,
		attachments: (0, _messageHelpers.getNewPlanAttachments)(prioritizedTasks)
	}, [{
		pattern: _constants.buttonValues.redoTasks.value,
		callback: function callback(response, convo) {

			prioritizedTasks = [];
			convo.newPlan.prioritizedTasks = prioritizedTasks;

			convo.say("Okay! Let's try this again :repeat:");
			startNewPlanFlow(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.done,
		callback: function callback(response, convo) {

			convo.newPlan.prioritizedTasks = prioritizedTasks;

			if (onboardVersion) {
				convo.say('Excellent! Now let\'s choose one priority to work on');
				convo.say('Unless you have a deadline, I recommend asking yourself *_"If this were the only thing I accomplished today, would I be satisfied for the day?_*"');
			} else {
				convo.say('Excellent!');
			}

			chooseFirstTask(convo);
			convo.next();
		}
	}, { // this is additional task added in this case.
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

			var newTaskArray = (0, _messageHelpers.convertResponseObjectToNewTaskArray)(response);
			newTaskArray.forEach(function (newTask) {
				prioritizedTasks.push(newTask);
			});

			taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTasks, options);

			updateTaskListMessageObject.text = question + '\n' + taskListMessage;

			var attachments = (0, _messageHelpers.getNewPlanAttachments)(prioritizedTasks);

			if (prioritizedTasks.length < 3) {
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);
				bot.api.chat.update(updateTaskListMessageObject);
			} else {

				while (prioritizedTasks.length > 3) {
					// only 3 priorities!
					prioritizedTasks.pop();
				}

				// we move on, with default to undo.
				updateTaskListMessageObject.attachments = JSON.stringify(_constants.taskListMessageNoButtonsAttachment);
				bot.api.chat.update(updateTaskListMessageObject);

				convo.newPlan.prioritizedTasks = prioritizedTasks;

				if (onboardVersion) {
					convo.say('Excellent! Now let\'s choose one priority to work on');
					convo.say('Unless you have a deadline, I recommend asking yourself *_"If this were the only thing I accomplished today, would I be satisfied for the day?_*"');
				} else {
					convo.say('Excellent!');
				}

				chooseFirstTask(convo);
				convo.next();
			}
		}
	}]);
}

function chooseFirstTask(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var bot = convo.task.bot;
	var _convo$newPlan2 = convo.newPlan;
	var daySplit = _convo$newPlan2.daySplit;
	var onboardVersion = _convo$newPlan2.onboardVersion;
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
	var _convo$newPlan3 = convo.newPlan;
	var tz = _convo$newPlan3.tz;
	var daySplit = _convo$newPlan3.daySplit;
	var onboardVersion = _convo$newPlan3.onboardVersion;
	var startTask = _convo$newPlan3.startTask;
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

	convo.say("Let's do it :weight_lifter:");

	var timeExample = (0, _momentTimezone2.default)().tz(tz).add(90, "minutes").format("h:mma");

	convo.ask({
		text: 'How long do you want to work on `' + taskString + '` for? (you can say `for 90 minutes` or `until ' + timeExample + '`)',
		attachments: [{
			attachment_type: 'default',
			callback_id: "MINUTES_SUGGESTION",
			fallback: "How long do you want to work on this task for?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
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
	var _convo$newPlan4 = convo.newPlan;
	var tz = _convo$newPlan4.tz;
	var daySplit = _convo$newPlan4.daySplit;
	var onboardVersion = _convo$newPlan4.onboardVersion;
	var startTask = _convo$newPlan4.startTask;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var timeExample = (0, _momentTimezone2.default)().tz(tz).add(10, "minutes").format("h:mma");
	convo.ask({
		text: 'When would you like to start? (`in 10 minutes` or `at ' + timeExample + '`)',
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

			convo.say("Okay! Let's do this now :muscle:");
			if (onboardVersion) {
				whoDoYouWantToInclude(convo);
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
				convo.say('Okay! I\'ll make sure to get you at ' + timeString + ' :timer_clock:');
				if (onboardVersion) {
					whoDoYouWantToInclude(convo);
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

function whoDoYouWantToInclude(convo) {
	var bot = convo.task.bot;
	var daySplit = convo.newPlan.daySplit;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;

	// we only ask this for the first time they make a new plan
	// this is part of onboard flow

	convo.say("One last thing! Is there anyone you want me to notify about your daily priorities?");
	convo.say("This makes it easy for you to communicate your outcomes for today, and stay in sync with your team to ensure that you're working on your highest priority items");
	convo.ask({
		text: 'Simply let me know the people you want to include by entering their handles here `i.e. let\'s include @chip and @kevin`',
		attachments: [{
			attachment_type: 'default',
			callback_id: "INCLUDE_NO_ONE",
			fallback: "Who do you want to include?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.include.noOne.name,
				text: "No one for now!",
				value: _constants.buttonValues.include.noOne.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.containsNoOne,
		callback: function callback(response, convo) {

			convo.say("Okay, you can always add this later by asking me to `update settings`!");
			convo.next();
		}
	}, {
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

					convo.say('Great! I\'ll notify ' + userNameStrings + ' about your daily priorities from now on');
					convo.say("If you want to change who you include, you can always `update settings`");
					convo.next();
				});
			} else {
				convo.say("You didn't include any users! I pick up who you want to include by their slack handles, like `@kevin`");
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
	var _convo$newPlan5 = convo.newPlan;
	var daySplit = _convo$newPlan5.daySplit;
	var onboardVersion = _convo$newPlan5.onboardVersion;
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
							whoDoYouWantToInclude(convo);
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