// for one-off thingz
import { bots } from '../bot/controllers';
import { controller } from '../bot/controllers';

// sequelize models
import models from './models';

import moment from 'moment-timezone';

export function updateUsers() {

	var allUsers = [];
	for (var token in bots) {
		bots[token].api.users.list({
			presence: 1
		}, (err, response) => {
			const { members } = response; // all members registered with your bot

			members.forEach((member) => {

				const { id, team_id, name, tz } = member;
				// var data = {
				// 	SlackUserId: id,
				// 	TeamId: team_id,
				// 	nickName: name,
				// 	tz
				// };

				models.SlackUser.find({
					where: { SlackUserId: id }
				})
				.then((slackUser) => {
					if (slackUser) {
						slackUser.update({
							TeamId: team_id,
							tz
						})
						models.User.find({
							where: [`"SlackUser"."SlackUserId" = ?`, id ],
							include: [ models.SlackUser ]
						})
						.then((user) => {
							user.update({
								nickName: name
							})
						})
					}
				});

			});
		})
	}

}

export function seedUsers() {

	var allUsers = [];
	for (var token in bots) {
		bots[token].api.users.list({
			presence: 1
		}, (err, response) => {
			const { members } = response; // all members registered with your bot

			members.forEach((member) => {
				const { id, team_id, name, tz } = member;
				var data = {
					SlackUserId: id,
					TeamId: team_id,
					nickName: name,
					tz
				};
				allUsers.push(data);
			});

			// all members are stored now... for the users who do not exist, seed them
			models.SlackUser.findAll({})
			.then((slackUsers) => {

				var totalSlackUsers = slackUsers.length;

				// do not create these ones
				var existingSlackUserIds = slackUsers.map((slackUser) => {
					return slackUser.SlackUserId;
				});

				allUsers.forEach((user) => {
					// create the ones that do not exist yet
					const { SlackUserId, TeamId, nickName, tz } = user;
					if (existingSlackUserIds.indexOf(SlackUserId) < 0) {
						var uniqueEmail = makeid();
						// this means not in array... lets create
						models.User.create({
							email: `TEMPEMAILHOLDER${uniqueEmail}@gmail.com`,
							nickName
						})
						.then((user) => {
							models.SlackUser.create({
								UserId: user.id,
								SlackUserId,
								tz,
								TeamId
							});
						});
					}
				});
			})

		})
	}

}

function makeid()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 10; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}