import { wit } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToMinutes, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';
import { sendPing } from '../pings/pingFunctions';

export default function(controller) {

	/**
	 *      SLASH COMMAND FLOW
	 */
	controller.on('slash_command', (bot, message) => {

		const { team_id, user_id } = message;
		const { intentObject: { entities: { reminder, duration, datetime } } } = message;

		let text          = message.text.trim();
		const SlackUserId = message.user;
		let env           = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev","");
		}

		// make sure verification token matches!
		if (message.token !== process.env.VERIFICATION_TOKEN) {
			console.log(`\n ~~ verification token could not be verified ~~ \n`)
			return;
		}

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			const { SlackName, tz } = user;
			const UserId = user.id;

			let now              = moment().tz(tz);
			const responseObject = { response_type: "ephemeral" }
			let slackNames       = getUniqueSlackUsersFromString(text, { normalSlackNames: true });

			let customTimeObject;
			let toSlackName = slackNames.length > 0 ? slackNames[0] : false;

			switch (message.command) {
				case "/focus":

					customTimeObject = witTimeResponseToTimeZoneObject(message, tz);

					const config     = { SlackUserId };
					config.content   = reminder ? reminder[0].value : null;

					if (customTimeObject) {
						let now = moment().tz(tz);
						let minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
						config.minutes = minutes;
					} else if (duration) {
						// if user puts in min and not picked up by customTimeObject
						config.minutes = witDurationToMinutes(duration);
					}

					controller.trigger(`begin_session_flow`, [ bot, config ]);
					responseObject.text = `Boom! Let's get this done :muscle:`;
					bot.replyPrivate(message, responseObject);
					break;

				case "/ping":

					// ping requires a receiving end
					if (toSlackName) {
						// if msg starts with @pinger, remove it from message
						let pingMessage = text[0] == "@" ? text.replace(/@(\S*)/,"").trim() : text;
						// for now this automatically queues to end of focus session
						models.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						})
						.then((toUser) => {

							const config = {
								deliveryType: "sessionEnd",
								pingMessages: [ pingMessage ]
							}
							const fromUserConfig = { UserId, SlackUserId }

							if (toUser) {

								// sucess! (this should happen 99% of the time)
								const toUserConfig   = { UserId: toUser.dataValues.id, SlackUserId: toUser.dataValues.SlackUserId }

								queuePing(bot, fromUserConfig, toUserConfig, config);

								responseObject.text = `Got it! I'll deliver that ping :mailbox_with_mail:`;
								bot.replyPrivate(message, responseObject);
								
							} else {

								// user might have changed names ... this is very rare!
								bot.api.users.list({}, (err, response) => {
									if (!err) {
										const { members } = response;
										let foundSlackUserId = false;
										let toUserConfig = {}
										members.some((member) => {
											if (toSlackName == member.name) {
												const SlackUserId = member.id;
												models.User.update({
													SlackName: name
												},
												{
													where: { SlackUserId }
												});
												foundSlackUserId = SlackUserId;
												return true;
											}
										});

										if (foundSlackUserId) {
											models.User.find({
												where: { SlackUserId: foundSlackUserId }
											})
											.then((toUser) => {
												const toUserConfig   = { UserId: toUser.dataValues.id, SlackUserId: toUser.dataValues.SlackUserId };
												queuePing(bot, fromUserConfig, toUserConfig, config);
												responseObject.text = `Got it! I'll deliver that ping :mailbox_with_mail:`;
												bot.replyPrivate(message, responseObject);
											})
										}
									}
								})

							}

						})

					} else {
						responseObject.text = `Let me know who you want to send this ping to! (i.e. \`@emily\`)`;
						bot.replyPrivate(message, responseObject);
					}

					break;

				case "/explain":
					if (toSlackName) {

						// if msg starts with @pinger, remove it from message
						let pingMessage = text[0] == "@" ? text.replace(/@(\S*)/,"").trim() : text;
						// for now this automatically queues to end of focus session
						models.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						})
						.then((toUser) => {

							if (toUser) {

								const config = {
									fromUserConfig: {
										UserId: user.dataValues.id,
										SlackUserId: user.dataValues.SlackUserId
									},
									toUserConfig: {
										UserId: toUser.dataValues.id,
										SlackUserId: toUser.dataValues.SlackUserId
									}
								};

								controller.trigger(`explain_toki_flow`, [ bot, config ]);

								responseObject.text = `Okay I just explained how I work to *@${toSlackName}!*`;
								bot.replyPrivate(message, responseObject);
							}
						});

					} else {
						responseObject.text = `Let me know who you want to explain myself to! (i.e. \`@emily\`)`;
						bot.replyPrivate(message, responseObject);
					}
					break;
				default:
					responseObject.text = `I'm sorry, still learning how to \`${message.command}\`! :dog:`;
					bot.replyPrivate(message, responseObject);
					break;
			}


		});

	});

}
