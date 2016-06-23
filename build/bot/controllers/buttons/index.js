'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on('interactive_message_callback', function (bot, message) {

		console.log("\n\n\n ~~ inside interactive_message_callback ~~ \n\n\n");
		console.log("this is message:");
		console.log(message);
		console.log("\n\n\n");

		// const SlackUserId = message.user;

		// const { actions, callback_id } = message;
		// if (callback_id == "test" && actions.length > 0) {
		// 	const { name, value } = actions[0];
		// 	console.log("callback!");
		// 	console.log(actions);

		// 	if (value == "QUIT_START_DAY") {
		// 		bot.replyInteractive(message, "restarting start day!");
		// 		controller.trigger('trigger_day_start', [bot, { SlackUserId }]);
		// 	}
		// }
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for "buttons" flow
//# sourceMappingURL=index.js.map