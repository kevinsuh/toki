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

export function test(bot) {

	// this to delete their last message if it was a morning ping!
	let SlackUserId = ``;
	bot.api.im.open({ user: SlackUserId }, (err, response) => {

		if (response.channel && response.channel.id) {
			let channel = response.channel.id;
			bot.api.im.history({ channel }, (err, response) => {

				if (response && response.messages && response.messages.length > 0) {

					let mostRecentMessage = response.messages[0];

					const { ts, attachments } = mostRecentMessage;
					if (attachments && attachments.length > 0 && attachments[0].callback_id == `MORNING_PING_START_DAY` && ts) {

						console.log("\n\n ~~ deleted ping day message! ~~ \n\n");
						// if the most recent message was a morning ping day, then we will delete it!
						let messageObject = {
							channel,
							ts
						};
						bot.api.chat.delete(messageObject);

					}
				}

			});
		}
		
	})
	

}

export function seedAndUpdateUsers(members, bot) {

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
							user.update({
								email,
								nickName: name
							})
							.then((user) => {
								models.SlackUser.create({
									SlackUserId,
									UserId: user.id,
									tz,
									TeamId: team_id,
									SlackName: name
								})
								.then((slackUser) => {
									// if slack user created, should be onboarded
									controller.trigger('begin_onboard_flow', [ bot, { SlackUserId } ]);
								})
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