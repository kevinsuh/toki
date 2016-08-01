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
		.then((slackUsers) => {
			console.log("got slack users included!");
			console.log(slackUsers);
		})
	})
}

export function updateUsers() {

	var env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		consoleLog("In development server of Toki");
	  process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	} else {
		consoleLog(`currently in ${env} environment`);
	}

	for (var token in bots) {

		// only dev for dev! and prod for prod!
		if (token == process.env.BOT_TOKEN) {

			const bot = bots[token];

			bot.api.users.list({
				presence: 1
			}, (err, response) => {
				const { members } = response; // all members registered with your bot

				members.forEach((member) => {

					console.log(`updating member:`);

					const { id, team_id, name, tz } = member;

					var SlackUserId = id;

					models.SlackUser.find({
						where: { SlackUserId }
					})
					.then((slackUser) => {

						if (slackUser) {

							slackUser.update({
								TeamId: team_id,
								tz
							});

							models.User.find({
								where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
								include: [ models.SlackUser ]
							})
							.then((user) => {

								if (member.profile && member.profile.email) {
									const { profile: { email } } = member;
									if (email) {
										console.log(`email found!`);
										user.update({
											email,
											nickName: name
										});
										return;
									}
								}

							})

						} else {

							// create slack user!
							// set through onboarding flow if first time user
							models.SlackUser.create({
								SlackUserId,
								TeamId: team_id,
								tz
							})
							.then((slackUser) => {

								if (member.profile && member.profile.email) {

									const { profile: { email } } = member;
									if (!email) {
										console.log("no email found");
										return;
									}

									models.User.find({
										where: [`"email" = ?`, email ]
									})
									.then((user) => {

										if (user) {

											user.update({
												nickName: name
											});
											slackUser.update({
												UserId: user.id
											})
											.then((slackUser) => {
												controller.trigger('begin_onboard_flow', [ bot, { SlackUserId } ]);
											})
												

										} else {

											models.User.create({
												email,
												nickName: name
											})
											.then((user) => {
												var UserId = user.id;
												slackUser.update({
													UserId
												})
												.then((slackUser) => {
													controller.trigger('begin_onboard_flow', [ bot, { SlackUserId } ]);
												})
													
											})
										}
									});

								}
							});
						}
					});
				});
			})
		}
	}
}


export function seedUsers() {

	return;

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
							consoleLog("Unique SlackUserId found... creating now");
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