'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 		DURING A WORK SESSION
  * 		
  * 		extend work session
  * 		cross out tasks
  * 		ask how much time left
  * 		
  */

	// EXTEND AN EXISTING WORK SESSION
	controller.hears(['extend_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		console.log("extending session!");
		console.log(JSON.stringify(message.intentObject));

		// these are array of objects
		var _message$intentObject = message.intentObject.entities;
		var session_duration = _message$intentObject.session_duration;
		var extend_to = _message$intentObject.extend_to;

		var now = (0, _momentTimezone2.default)();

		console.log("here extending session");

		// var timezone = String(String(now.utc()._d).split("(")[1]).split(")")[0];

		// this means user requested duration extension (i.e. 10 more minutes)
		if (session_duration) {

			var durationSeconds = 0;
			for (var i = 0; i < session_duration.length; i++) {
				durationSeconds += session_duration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);

			var extendedTime = now.add(durationSeconds, 'seconds');
			extendedTime = extendedTime.format('h:mm a');

			bot.reply(message, 'Okay, ' + durationMinutes + ' minutes added :timer_clock: . See you at ' + extendedTime + '!');
		} else if (extend_to) {

			var extendToTimestamp = extend_to[0].to.value;
			extendToTimestamp = (0, _momentTimezone2.default)(extendToTimestamp); // in PST because of Wit default settings

			extendToTimestamp.add(extendToTimestamp._tzm - now.utcOffset(), 'minutes'); // convert from PST to local TZ

			var extendedTime = extendToTimestamp.format('h:mm a');

			bot.reply(message, 'Okay, see you at ' + extendedTime + ' :timer_clock:!');
		} else {

			bot.reply(message, 'Sorry, didn\'t catch that. How long do you want to extend your session for?');
		}
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// MIDDLE OF A WORK SESSION
//# sourceMappingURL=middleWorkSession.js.map