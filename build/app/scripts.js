'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.updateUsers = updateUsers;
exports.seedUsers = seedUsers;

var _controllers = require('../bot/controllers');

var _miscHelpers = require('../bot/lib/miscHelpers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// sequelize models
function updateUsers() {

	for (var token in _controllers.bots) {
		_controllers.bots[token].api.users.list({
			presence: 1
		}, function (err, response) {
			var members = response.members; // all members registered with your bot

			members.forEach(function (member) {
				var id = member.id;
				var team_id = member.team_id;
				var name = member.name;
				var tz = member.tz;


				_models2.default.SlackUser.find({
					where: { SlackUserId: id }
				}).then(function (slackUser) {
					if (slackUser) {
						slackUser.update({
							TeamId: team_id,
							tz: tz
						});
						_models2.default.User.find({
							where: ['"SlackUser"."SlackUserId" = ?', id],
							include: [_models2.default.SlackUser]
						}).then(function (user) {
							user.update({
								nickName: name
							});
						});
					}
				});
			});
		});
	}
} /**
   * 		For fun one-off thingz
   */

function seedUsers() {

	var slackUserIds = []; // make sure only unique slack user ids are put in!
	for (var token in _controllers.bots) {

		_controllers.bots[token].api.users.list({
			presence: 1
		}, function (err, response) {
			var members = response.members; // all members registered with your bot

			members.forEach(function (member) {
				var id = member.id;
				var team_id = member.team_id;
				var name = member.name;
				var tz = member.tz;

				// this helps us stay unique with SlackUserId

				if (slackUserIds.indexOf(id) < 0) {
					slackUserIds.push(id);
					_models2.default.SlackUser.find({
						where: { SlackUserId: id }
					}).then(function (slackUser) {
						if (!slackUser) {
							(0, _miscHelpers.consoleLog)("Unique SlackUserId found... creating now");
							var uniqueEmail = makeid();
							_models2.default.User.create({
								email: 'TEMPEMAILHOLDER' + uniqueEmail + '@gmail.com',
								nickName: name
							}).then(function (user) {
								_models2.default.SlackUser.create({
									SlackUserId: id,
									UserId: user.id,
									tz: tz,
									TeamId: team_id
								});
							});
						}
					});
				}
			});
		});
	}
}

function makeid() {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 10; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}return text;
}
//# sourceMappingURL=scripts.js.map