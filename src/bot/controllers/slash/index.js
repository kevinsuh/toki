import { wit } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToMinutes, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';
import { queuePing } from '../pings/pingFunctions';

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
				case "/doing":

					controller.trigger(`begin_session_flow`, [ bot, message ]);
					responseObject.text = `Woo! You can do it :dancer:`;
					bot.replyPrivate(message, responseObject);
					break;

				case "/ping":

					// ping requires a receiving end
					if (toSlackName) {
						// if msg starts with @pinger, remove it from message
						let pingMessage = text[0] == "@" ? text.replace(/@(\S*)/,"").trim() : text;
						let pingMessages = [];
						if (pingMessage) pingMessages.push(pingMessage);

						// for now this automatically queues to end of session
						models.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						})
						.then((toUser) => {

							if (toUser) { 

								// check if user is in session... if so, then do not DM receipt
								toUser.getSessions({
									where: [ `"open" = ?`, true ],
									order: `"Session"."createdAt" DESC`
								})
								.then((sessions) => {

									let session = sessions[0];

									if (session) {

										let pingFlowConfig = {
											SlackUserId,
											pingSlackUserIds: [ toUser.dataValues.SlackUserId ],
											pingMessages
										}

										controller.trigger(`ping_flow`, [bot, message, pingFlowConfig]);
										responseObject.text = `Got it! Let's deliver that ping :mailbox_with_mail:`;
										bot.replyPrivate(message, responseObject);

									} else {

										// user is not in session, no need for DM receipt!
										const fromUserConfig = { UserId, SlackUserId };
										const toUserConfig   = { UserId: toUser.dataValues.id, SlackUserId: toUser.dataValues.SlackUserId };
										const config   = {
											deliveryType: constants.pingDeliveryTypes.sessionNotIn,
											pingMessages
										};

										queuePing(bot, fromUserConfig, toUserConfig, config);
										responseObject.text = `<@${toUser.dataValues.SlackUserId}> is not in a session so I started a conversation for you. Thank you for being mindful of their attention :raised_hands:`;
										bot.replyPrivate(message, responseObject);
										

									}

								});

								
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

												let pingFlowConfig = {
													SlackUserId, // fromUser SlackUserId
													message,
													pingSlackUserIds: [ toUser.dataValues.SlackUserId ],
													pingMessages
												}
												
												controller.trigger(`ping_flow`, [bot, pingFlowConfig]);
												responseObject.text = `Got it! Let's deliver that ping :mailbox_with_mail:`;
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
						// for now this automatically queues to end of session
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

								responseObject.text = `Okay I just explained how I work to <@${toUser.dataValues.SlackUserId}>!`;
								bot.replyPrivate(message, responseObject);
							}
						});

					} else { // assume to self
						
						const explainConfig = {
							explainToSelf: true,
							UserConfig: {
								UserId: user.dataValues.id,
								SlackUserId: user.dataValues.SlackUserId
							}
						};

						controller.trigger(`explain_toki_flow`, [ bot, explainConfig ]);

						responseObject.text = `Thanks for asking me how I work! If you ever want to explain me to someone else, just include their username (i.e. \`@emily\`)`;
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
