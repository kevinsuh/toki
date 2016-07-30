'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startNewPlanFlow = startNewPlanFlow;
exports.startNewPlanWizardFlow = startNewPlanWizardFlow;

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

function startNewPlanFlow(convo) {}

function startNewPlanWizardFlow(convo) {
	var bot = convo.task.bot;
	var daySplit = convo.newPlan.daySplit;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var contextDay = "today";
	if (daySplit != _constants.constants.MORNING.word) {
		contextDay = 'this ' + daySplit;
	}
	var question = 'What are the top 3 most anxious or uncomfortable things you have on your plate ' + contextDay + '?';

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
		pattern: _constants.buttonValues.doneAddingTasks.value,
		callback: function callback(response, convo) {
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.done,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Excellent!");
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
				// we move on, with default to undo.
				updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageNoButtonsAttachment);
				bot.api.chat.update(updateTaskListMessageObject);
				convo.say("Good to know!");
				convo.next();
				console.log(prioritizedTasks);
			}
		}
	}]);
}
//# sourceMappingURL=plan.js.map