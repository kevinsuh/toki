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
	var autoWizard = _convo$newPlan.autoWizard;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var contextDay = "today";
	if (daySplit != _constants.constants.MORNING.word) {
		contextDay = 'this ' + daySplit;
	}
	var question = 'What are the top 3 most anxious or uncomfortable things you have on your plate ' + contextDay + '?';
	if (autoWizard) {
		question = question + ' Please enter each one in a separate message!';
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

			convo.say("Okay, let's do try this again :repeat:");
			startNewPlanFlow(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.done,
		callback: function callback(response, convo) {

			convo.newPlan.prioritizedTasks = prioritizedTasks;

			convo.say("Excellent!");

			if (autoWizard) {
				wizardPrioritizeTasks(convo);
			} else {
				prioritizeTasks(convo);
			}

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

				convo.say("Excellent!");

				if (autoWizard) {
					wizardPrioritizeTasks(convo);
				} else {
					prioritizeTasks(convo);
				}

				convo.next();
			}
		}
	}]);
}

function prioritizeTasks(convo) {}

function wizardPrioritizeTasks(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan2 = convo.newPlan;
	var daySplit = _convo$newPlan2.daySplit;
	var autoWizard = _convo$newPlan2.autoWizard;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	if (prioritizedTasks.length == 1) {
		// 1 task needs no prioritizing
		convo.newPlan.startTaskIndex = 0;
		startOnTask(convo);
	} else {
		// 2+ tasks need prioritizing
		var question = 'Out of your ' + prioritizedTasks.length + ' priorities, which one would most make the rest of your day easier, or your other tasks more irrelevant?';

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
					name: _constants.buttonValues.workOnDifferentTask.name,
					text: "Wait, this is wrong!",
					value: _constants.buttonValues.workOnDifferentTask.value,
					type: "button"
				}]
			}]
		}, [{
			pattern: _botResponses.utterances.containsDifferent,
			callback: function callback(response, convo) {

				convo.say("Okay, let's do try this again :repeat:");
				startNewPlanFlow(convo);
				convo.next();
			}
		}, {
			pattern: _botResponses.utterances.containsNumber,
			callback: function callback(response, convo) {

				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, prioritizedTasks);
				var taskIndexToWorkOn = taskNumbersToWorkOnArray[0] - 1;

				if (taskIndexToWorkOn >= 0) {
					convo.newPlan.startTaskIndex = taskIndexToWorkOn;
					startOnTask(convo);
				} else {
					convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
					convo.repeat();
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

function startOnTask(convo) {
	var _convo$newPlan3 = convo.newPlan;
	var tz = _convo$newPlan3.tz;
	var daySplit = _convo$newPlan3.daySplit;
	var autoWizard = _convo$newPlan3.autoWizard;
	var startTaskIndex = _convo$newPlan3.startTaskIndex;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var taskString = prioritizedTasks[startTaskIndex].text;

	convo.say({
		text: 'Great! Let\'s find time to do `' + taskString + '` then',
		attachments: [{
			attachment_type: 'default',
			callback_id: "CHANGE_TASK",
			fallback: "Do you want to work on this task?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.workOnDifferentTask.name,
				text: "Wait, this is wrong!",
				value: _constants.buttonValues.workOnDifferentTask.value,
				type: "button"
			}]
		}]
	});

	convo.ask("When would you like to start? You can tell me a specific time, like `4pm`, or a relative time, like `in 10 minutes`", [{
		pattern: _botResponses.utterances.containsDifferent,
		callback: function callback(response, convo) {

			convo.say("Okay, let's do a different task!");
			chooseDifferentTask(convo);
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

			var minutes = void 0;
			var now = (0, _momentTimezone2.default)();
			if (customTimeObject) {
				if (duration) {
					minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
				} else {
					minutes = parseInt(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				}
				convo.say('Okay! You want to start this task in ' + minutes + ' minutes');
			} else {
				convo.say("Sorry, I didn't catch that. Let me know a time `i.e. let's start in 10 minutes`");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}

function chooseDifferentTask(convo) {
	var _convo$newPlan4 = convo.newPlan;
	var daySplit = _convo$newPlan4.daySplit;
	var autoWizard = _convo$newPlan4.autoWizard;
	var startTaskIndex = _convo$newPlan4.startTaskIndex;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	convo.ask("What task do you want to do?", function (response, convo) {});
}
//# sourceMappingURL=plan.js.map