/**
 * 		For fun one-off thingz
 */

import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones, tokiExplainAttachments } from '../bot/lib/constants';


export function test(bot) {
	
	// U1NCGAETZ slackid of @test
	// U121ZK15J slackid of @kevin
	const SlackUserIds = `U1NCGAETZ,U121ZK15J`;
	bot.api.mpim.open({
		users: SlackUserIds
	}, (err, response) => {
		console.log(response);
		if (!err) {

			const { group: { id } } = response;
			bot.api.mpim.history({
				channel: id
			}, (err, response) => {

				if (!err) {

					const { messages } = response;
					console.log(`\n\n\n displaying the ${messages.length} messages for this convo`);
					console.log(messages[0]);
					const timeStampObject = moment.unix(messages[0].ts);
					console.log(`\n\n\n timestamp: ${timeStampObject.format()}`);

					if (messages[0].reactions) {
						console.log(messages[0].reactions);
					}

				}

			});

		}
	});

	bot.api.channels.list({
	}, (err, response) => {

		if (!err) {

			const { channels } = response;
			channels.forEach((channel) => {
				const { id, name, is_channel, topic, purpose, members } = channel;
				if (name == 'distractions') {

					console.log(`\n\n in distractions:`);
					console.log(channel);
					console.log(members);
					// bot.send({
					// 	channel: id,
					// 	text: `<@U121U9CAU> is working on \`test this out\` until *3:31pm*`,
					// 	attachments: [
					// 		{
					// 			attachment_type: 'default',
					// 			callback_id: "LETS_FOCUS_AGAIN",
					// 			fallback: "Let's focus again!",
					// 			actions: [
					// 				{
					// 					name: `PING CHIP`,
					// 					text: "Send Message",
					// 					value: `{"pingUser": true, "PingToSlackUserId": "U121U9CAU"}`,
					// 					type: "button"
					// 				},
					// 			]
					// 		}
					// 	]
					// });

				}
			});


		} else {
			console.log(`\n\n\n ~~ error in listing channel:`);
			console.log(err);
		}

	});

	bot.api.groups.create({
		name: `kevin-dashboard`
	}, (err, response) => {

		console.log(`\n\n\n group created:`);
		console.log(response);

	})

}

export function seedAndUpdateUsers(members) {

	members.forEach((member) => {

		const { id, team_id, name, tz } = member;

		const SlackUserId = id;

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			if (user) {

				user.update({
					TeamId: team_id,
					SlackName: name
				});
				if (member.profile && member.profile.email) {
					const { profile: { email } } = member;
					if (email && user.email == '') {
						user.update({
							email
						})
					}
				}

			} else {

				console.log("\n\n ~~ new user and creating ~~ \n\n");
				let email = '';
				if (member.profile && member.profile.email)
					email = member.profile.email;
				models.User.create({
					SlackUserId,
					email,
					TeamId: team_id,
					SlackName: name,
				});

			}
		});

	});

}