/**
 * 		For fun one-off thingz
 */

import { bots } from '../bot/controllers';
import { controller } from '../bot/controllers';
import { consoleLog } from '../bot/lib/miscHelpers';

// sequelize models
import models from './models';

import moment from 'moment-timezone';

import dotenv from 'dotenv';

export function test() {
	models.SlackUser.find({
		where: [`"SlackUser"."SlackUserId" = ?`, "U121ZK15J"]
	})
	.then((slackUser) => {
		slackUser.getIncluded({
			include: [ models.User ]
		})
		.then((includedSlackUsers) => {
			console.log("got slack users included!");
			console.log(includedSlackUsers);
		})
	})
}

export function seedAndUpdateUsers(members) {

	members.forEach((member) => {

		const { id, team_id, name, tz } = member;

		const SlackUserId = id;

		models.SlackUser.find({
			where: { SlackUserId }
		})
		.then((slackUser) => {

			if (slackUser) {

				slackUser.update({
					TeamId: team_id,
					SlackName: name
				});

				models.User.find({
					where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
					include: [ models.SlackUser ]
				})
				.then((user) => {

					if (member.profile && member.profile.email) {
						const { profile: { email } } = member;
						if (email && user.email == '') {
							console.log(`updating email!`);
							user.update({
								email
							});
						}
					}
				})

			} else {

				let email = '';
				if (member.profile && member.profile.email)
					email = member.profile.email;

				models.User.find({
					where: [`"email" = ?`, email ],
					include: [ models.SlackUser ]
				})
				.then((user) => {

					if (user) {

						if (user.SlackUser) {
							console.log(`\n\n USER FOUND WITHOUT SLACKUSER (${name})... FIXING THAT ... \n\n`);
							user.SlackUser.update({
								UserId: user.id
							})
						} else {
							console.log(`\n\n CREATING UNIQUE USER (${name}) ... \n\n`);
							// more common situation
							models.User.create({
								nickName: name,
								email
							})
							.then((user) => {
								models.SlackUser.create({
									SlackUserId,
									UserId: user.id,
									tz,
									TeamId: team_id,
									SlackName: name
								});
							});
						}

					}
				});

			}

		});

	})

}

function makeid()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 10; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}