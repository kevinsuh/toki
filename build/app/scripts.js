'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.test = test;
exports.seedAndUpdateUsers = seedAndUpdateUsers;

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		For fun one-off thingz
 */

function test(bot) {

	// U1NCGAETZ slackid of @test
	// U121ZK15J slackid of @kevin
	var SlackUserIds = 'U1NCGAETZ,U121ZK15J';
	bot.api.mpim.open({
		users: SlackUserIds
	}, function (err, response) {
		console.log(response);
		if (!err) {
			var id = response.group.id;

			bot.api.mpim.history({
				channel: id
			}, function (err, response) {

				if (!err) {
					var messages = response.messages;

					console.log('\n\n\n displaying the ' + messages.length + ' messages for this convo');
					console.log(messages[0]);
					var timeStampObject = _momentTimezone2.default.unix(messages[0].ts);
					console.log('\n\n\n timestamp: ' + timeStampObject.format());

					if (messages[0].reactions) {
						console.log(messages[0].reactions);
					}
				}
			});
		}
	});
}

function seedAndUpdateUsers(members) {

	members.forEach(function (member) {
		var id = member.id;
		var team_id = member.team_id;
		var name = member.name;
		var tz = member.tz;


		var SlackUserId = id;

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			if (user) {

				user.update({
					TeamId: team_id,
					SlackName: name
				});
				if (member.profile && member.profile.email) {
					var email = member.profile.email;

					if (email && user.email == '') {
						user.update({
							email: email
						});
					}
				}
			} else {

				console.log("\n\n ~~ new user and creating ~~ \n\n");
				var _email = '';
				if (member.profile && member.profile.email) _email = member.profile.email;
				_models2.default.User.create({
					SlackUserId: SlackUserId,
					email: _email,
					TeamId: team_id,
					SlackName: name
				});
			}
		});
	});
}
//# sourceMappingURL=scripts.js.map