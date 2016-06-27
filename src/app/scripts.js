/**
 * 		For fun one-off thingz
 */

import { bots } from '../bot/controllers';
import { controller } from '../bot/controllers';

// sequelize models
import models from './models';

import moment from 'moment-timezone';

export function updateUsers() {

	for (var token in bots) {
		bots[token].api.users.list({
			presence: 1
		}, (err, response) => {
			const { members } = response; // all members registered with your bot

			members.forEach((member) => {

				const { id, team_id, name, tz } = member;
				console.log(`\n\n ~~ member for bot: ${token} ~~ \n\n`);
				console.log(member);
				console.log("\n\n")

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

	var slackUserIds = []; // make sure only unique slack user ids are put in!
	for (var token in bots) {
		
		bots[token].api.users.list({
			presence: 1
		}, (err, response) => {
			const { members } = response; // all members registered with your bot

			members.forEach((member) => {
				const { id, team_id, name, tz } = member;

				// this helps us stay unique with SlackUserId
				if (slackUserIds.indexOf(id) < 0) {
					slackUserIds.push(id); 
					models.SlackUser.find({
						where: { SlackUserId: id }
					})
					.then((slackUser) => {
						if (!slackUser) {
							console.log("\n\n ~~ Unique SlackUserId found... creating now ~~ \n\n");
							var uniqueEmail = makeid();
							models.User.create({
								email: `TEMPEMAILHOLDER${uniqueEmail}@gmail.com`,
								nickName: name
							})
							.then((user) => {
								models.SlackUser.create({
									SlackUserId: id,
									UserId: user.id,
									tz,
									TeamId: team_id
								});
							});
						}
					})
				}
			});
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