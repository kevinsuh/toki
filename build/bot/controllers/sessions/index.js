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

				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				}

				var currentSession = sessions[0];

				if (currentSession) {
					(function () {
						// give status!

						var now = (0, _momentTimezone2.default)().tz(tz);
						var endTime = (0, _momentTimezone2.default)(currentSession.dataValues.endTime).tz(tz);
						var endTimeString = endTime.format("h:mma");

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say('You\'re in a session right now for `' + currentSession.dataValues.content + '`. Keep focusing and I\'ll see you at *' + endTimeString + '* :raised_hands:');
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
			convo.ask('You\'re not in a session right now! Would you like to start one?', [{
				pattern: _constants.utterances.yes,
				callback: function callback(response, convo) {
					convo.startSession = true;
					convo.next();
				}
			}, {
				pattern: _constants.utterances.no,
				callback: function callback(response, convo) {
					convo.say("Okay! Let me know when you want to `get focused` :smile_cat:");
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {
					convo.say("Sorry, I didn't catch that");
					convo.repeat();
					convo.next();
				}
			}]);
			convo.next();
			convo.on('end', function (convo) {
				if (convo.startSession) {
					controller.trigger('begin_session_flow', [bot, config]);
				}
			});
		});
	}
}
//# sourceMappingURL=index.js.map