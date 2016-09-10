'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 		INDEX functions of work sessions
  */

	(0, _startSession2.default)(controller);
	(0, _endSession2.default)(controller);

	// get current session status!
	controller.on('current_session_status', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			user.getSessions({
				where: ['"open" = ?', true]
			}).then(function (sessions) {
				// need user's timezone for this flow!
				var tz = user.tz;

				var UserId = user.id;

				var currentSession = sessions[0];

				if (currentSession && tz) {
					(function () {
						// if in session, means you have your tz config'd

						var now = (0, _momentTimezone2.default)().tz(tz);
						var endTime = (0, _momentTimezone2.default)(currentSession.dataValues.endTime).tz(tz);
						var endTimeString = endTime.format("h:mma");

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say('You\'re currently working on `' + currentSession.dataValues.content + '`. Keep jamming and I\'ll see you at *' + endTimeString + '* :raised_hands:');
						});
					})();
				} else {
					// ask to start new session!
					notInSessionWouldYouLikeToStartOne({ bot: bot, SlackUserId: SlackUserId, controller: controller });
				}
			});
		});
	});
};

exports.notInSessionWouldYouLikeToStartOne = notInSessionWouldYouLikeToStartOne;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _startSession = require('./startSession');

var _startSession2 = _interopRequireDefault(_startSession);

var _endSession = require('./endSession');

var _endSession2 = _interopRequireDefault(_endSession);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for work sessions!
function notInSessionWouldYouLikeToStartOne(config) {
	var bot = config.bot;
	var SlackUserId = config.SlackUserId;
	var controller = config.controller;

	if (bot && SlackUserId && controller) {
		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say('You don\'t have a current focus set! Let me know when to `/focus` on something :smile_cat:');
		});
	}
}
//# sourceMappingURL=index.js.map