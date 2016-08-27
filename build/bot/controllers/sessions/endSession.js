'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['end_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		/**
   * 			check if user has open session (should only be one)
   * 					if yes, trigger finish and end_session flow
   * 			  	if no, reply with confusion & other options
   */

		var SlackUserId = message.user;
		var doneSessionEarly = true;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {}, 800);
	});

	/**
  * 		User has confirmed to ending session
  * 		This will immediately close the session, then move to
  * 		specified "post session" options
  */
	controller.on('end_session_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var sessionTimerUp = config.sessionTimerUp;
		var endSessionEarly = config.endSessionEarly;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;

			var UserId = user.id;

			user.getSessions({
				where: ['"open" = ?', true],
				order: '"Session"."createdAt" DESC'
			}).then(function (sessions) {

				var session = sessions[0];

				if (session) {

					// only update endTime if it is less than current endTime
					var now = (0, _momentTimezone2.default)();
					var endTime = (0, _momentTimezone2.default)(session.dataValues.endTime);
					if (now < endTime) endTime = now;

					workSession.update({
						open: false,
						live: false,
						endTime: endTime
					}).then(function (session) {

						var startTimeObject = (0, _momentTimezone2.default)(session.dataValues.startTime).tz(tz);
						var endTimeObject = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz);
						var endTimeString = endTimeObject.format("h:mm a");
						var sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
						var sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							// have 5-minute exit time limit
							convo.task.timeLimit = 1000 * 60 * 5;

							convo.sessionEnd = {
								UserId: UserId,
								SlackUserId: SlackUserId,
								tz: tz,
								endSessionEarly: endSessionEarly,
								sessionTimerUp: sessionTimerUp
							};

							if (sessionTimerUp) {
								convo.say('Your session is up!');
							}

							startEndSessionFlow(convo);

							convo.on('end', function (convo) {});
						});
					});
				}
			});
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=endSession.js.map