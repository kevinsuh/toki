'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.seedAndUpdateUsers = seedAndUpdateUsers;

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('../bot/lib/constants');

var _slackHelpers = require('../bot/lib/slackHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
} /**
   * 		For fun one-off thingz
   */
//# sourceMappingURL=scripts.js.map