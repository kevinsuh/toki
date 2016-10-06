'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getAuthAddress = getAuthAddress;
exports.startBot = startBot;
exports.saveUserOnRegistration = saveUserOnRegistration;
exports.saveUserOnLogin = saveUserOnLogin;

var _controllers = require('../../bot/controllers');

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _models = require('../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getAuthAddress(authCode, uri_path) {

	var env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		console.log("\n\n ~~ In development part of Toki install ~~ \n\n");
		process.env.SLACK_ID = process.env.DEV_SLACK_ID;
		process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
		process.env.SLACK_REDIRECT = process.env.DEV_SLACK_REDIRECT;
	}

	//post code, app ID, and app secret, to get token
	var authAddress = 'https://slack.com/api/oauth.access?';
	authAddress += 'client_id=' + process.env.SLACK_ID;
	authAddress += '&client_secret=' + process.env.SLACK_SECRET;
	authAddress += '&code=' + authCode;
	authAddress += '&redirect_uri=' + process.env.SLACK_REDIRECT + uri_path;
	return authAddress;
}

function startBot(team, type) {
	console.log("starting bot.... ");
	console.log(team);
	if (type == 'login') {
		var identity = team;
		(0, _controllers.connectOnLogin)(identity);
	} else if (type == 'create') {
		(0, _controllers.connectOnInstall)(team);
	}
}

// on register team
function saveUserOnRegistration(auth, identity) {

	_controllers.controller.storage.users.get(identity.user_id, function (err, user) {

		var isnew = user ? false : true;
		// data from slack API to create or update our DB with
		user = {
			id: identity.user_id,
			access_token: auth.access_token,
			scopes: auth.scope,
			team_id: identity.team_id,
			user: identity.user
		};

		_controllers.controller.storage.users.save(user, function (err, id) {
			if (err) {
				console.log('An error occurred while saving a user: ', err);
				_controllers.controller.trigger('error', [err]);
			} else {
				if (isnew) {
					console.log("New user " + id.toString() + " saved");
				} else {
					console.log("User " + id.toString() + " updated");
				}
				console.log("================== END TEAM REGISTRATION ==================");
			}
		});
	});
}

// on login
function saveUserOnLogin(auth, identity) {

	_controllers.controller.storage.users.get(identity.user_id, function (err, user) {

		var isnew = user ? false : true;
		// data from slack API to create or update our DB with
		user = {
			id: identity.user_id,
			access_token: auth.access_token,
			scopes: auth.scope,
			team_id: identity.team_id,
			user: identity.user
		};

		_controllers.controller.storage.users.save(user, function (err, user) {
			if (err) {
				console.log('An error occurred while saving a user: ', err);
				_controllers.controller.trigger('error', [err]);
			} else {
				(function () {
					if (isnew) {
						console.log("New user " + user.id + " saved");
					} else {
						console.log("User " + user.id + " updated");
					}

					// get the right bot, and trigger onboard flow here
					var SlackUserId = user.id;
					var TeamId = user.team_id;

					_models2.default.Team.find({
						where: { TeamId: TeamId }
					}).then(function (team) {
						if (team) {
							var token = team.token;

							var bot = _controllers.bots[token];
							if (bot) {
								var config = { SlackUserId: SlackUserId };
							}
						}
					});

					console.log("================== END TEAM REGISTRATION ==================");
				})();
			}
		});
	});
}
//# sourceMappingURL=helpers.js.map