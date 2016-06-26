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

			allUsers.forEach((user) => {
				const { SlackUserId, TeamId, nickName, tz } = user;
				models.SlackUser.find({
					where: { SlackUserId }
				})
				.then((slackUser) => {
					// only create uniques
					if (!slackUser) {
						var uniqueEmail = makeid();
						models.User.create({
							email: `TEMPEMAILHOLDER${uniqueEmail}@gmail.com`,
							nickName
						})
						.then((user) => {
							models.SlackUser.create({
								SlackUserId,
								UserId: user.id,
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