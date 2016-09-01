import { connectOnLogin, connectOnInstall } from '../../bot/controllers';
import { controller, bots } from '../../bot/controllers';
import models from '../models';

export function getAuthAddress(authCode, uri_path) {
	//post code, app ID, and app secret, to get token
	var authAddress = 'https://slack.com/api/oauth.access?'
	authAddress += 'client_id=' + process.env.SLACK_ID
	authAddress += '&client_secret=' + process.env.SLACK_SECRET
	authAddress += '&code=' + authCode
	authAddress += '&redirect_uri=' + process.env.SLACK_REDIRECT + uri_path;
	return authAddress;
}

export function startBot(team, type) {
	console.log("starting bot.... ");
	console.log(team);
	if (type == 'login') {
		var identity = team;
		connectOnLogin(identity);
	} else if (type == 'create') {
		connectOnInstall(team)
	}
}

// on register team
export function saveUserOnRegistration(auth, identity) {

	return;

	controller.storage.users.get(identity.user_id, function(err, user) {

		var isnew = user ? false : true;
		// data from slack API to create or update our DB with
		user = {
			id: identity.user_id,
			access_token: auth.access_token,
			scopes: auth.scope,
			team_id: identity.team_id,
			user: identity.user
		};
		
		controller.storage.users.save(user, function(err, id) {
			if (err) {
				console.log('An error occurred while saving a user: ', err);
				controller.trigger('error', [err]);
			}
			else {
				if (isnew) {
					console.log("New user " + id.toString() + " saved");
				}
				else {
					console.log("User " + id.toString() + " updated");
				}
				console.log("================== END TEAM REGISTRATION ==================")
			}
		});
	});

}

// on login
export function saveUserOnLogin(auth, identity) {

	controller.storage.users.get(identity.user.id, function(err, user) {

		let isnew = user ? false : true;
		// data from slack API to create or update our DB with
		user = {
			id: identity.user.id,
			access_token: auth.access_token,
			scopes: auth.scope,
			team_id: identity.team.id,
			user: identity.user.name
		};

		controller.storage.users.save(user, function(err, user) {
			if (err) {
				console.log('An error occurred while saving a user: ', err);
				controller.trigger('error', [err]);
			}
			else {
				if (isnew) {
					console.log("New user " + user.id + " saved");
				}
				else {
					console.log("User " + user.id + " updated");
				}

				// get the right bot, and trigger onboard flow here
				let SlackUserId = user.id;
				let TeamId      = user.team_id;

				models.Team.find({
					where: { TeamId }
				})
				.then((team) => {
					if (team) {
						const { token } = team;
						let bot = bots[token];
						if (bot) {
							let config = { SlackUserId };
						}
					}
				});

				console.log("================== END TEAM REGISTRATION ==================")
			}
		});
	});

}



