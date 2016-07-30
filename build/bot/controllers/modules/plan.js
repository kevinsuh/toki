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

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

			updateTaskListMessageObject.text = question;
			updateTaskListMessageObject.attachments = JSON.stringify((0, _messageHelpers.getNewPlanAttachments)(prioritizedTasks));
			bot.api.chat.update(updateTaskListMessageObject);

			convo.silentRepeat();
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

		convo.ask(question + '\n' + taskListMessage, [{
			pattern: _botResponses.utterances.containsNumber,
			callback: function callback(response, convo) {

				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, prioritizedTasks);
				var taskIndexToWorkOn = taskNumbersToWorkOnArray[0] - 1;

				if (taskIndexToWorkOn) {
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
	var daySplit = _convo$newPlan3.daySplit;
	var autoWizard = _convo$newPlan3.autoWizard;
	var startTaskIndex = _convo$newPlan3.startTaskIndex;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var taskString = prioritizedTasks[startTaskIndex].text;

	convo.say('Great! Let\'s find time to work on `' + taskString + '`');
	convo.ask("When would you like to start? You can tell me a specific time, like `4pm`, or a relative time, like `in 10 minutes`", function (response, convo) {

		// use wit to decipher the relative time

	});
}
//# sourceMappingURL=plan.js.map