'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on('interactive_message_callback', function (bot, message) {

		var SlackUserId = message.user;
		var actions = message.actions;
		var callback_id = message.callback_id;

		var payload = void 0;
		var config = void 0;

		// need to replace buttons so user cannot reclick it
		if (actions && actions.length > 0) {
			switch (actions[0].value) {
				case _constants.buttonValues.doneSessionTimeoutYes.value:
					controller.trigger('done_session_yes_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.doneSessionTimeoutSnooze.value:
					_models2.default.User.find({
						where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
						include: [_models2.default.SlackUser]
					}).then(function (user) {
						controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					});
					break;
				case _constants.buttonValues.doneSessionTimeoutDidSomethingElse.value:
					controller.trigger('end_session', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.doneSessionTimeoutNo.value:
					controller.trigger('done_session_no_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.startSession.pause.value:
					controller.trigger('session_pause_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.startSession.addCheckIn.value:
					controller.trigger('session_add_checkin_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.startSession.resume.value:
					controller.trigger('session_resume_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				default:
					break;
			}
		}
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

var _constants = require('../../lib/constants');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for "buttons" flow
//# sourceMappingURL=index.js.map