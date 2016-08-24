import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getRandomExample, commaSeparateOutStringArray, getMostRecentMessageToUpdate, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';

/**
 * 		PING CONVERSATION FLOW FUNCTIONS
 */

export function startPingFlow(convo) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

	if (pingSlackUserIds) {
		handlePingSlackUserIds(convo);
	} else {
		askWhoToPing(convo);
	}

}

function askWhoToPing(convo, text = `Who would you like to ping? You can type their username, like \`@emily\``) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

	let attachments = [{
		attachment_type: 'default',
		callback_id: "WHO_TO_PING",
		fallback: "Who would you like to ping?",
		actions: [{
				name: buttonValues.neverMind.name,
				text: `Never Mind!`,
				value: buttonValues.neverMind.value,
				type: `button`
			}]
	}];

	convo.ask({
		text,
		attachments
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Ok! Just let me know if you want to ping someone on your team`); // in future check if in session
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				const { text } = response;
				const pingSlackUserIds = getUniqueSlackUsersFromString(text);

				if (pingSlackUserIds.length > 0) {

					convo.pingObject.pingSlackUserIds = pingSlackUserIds;
					handlePingSlackUserIds(convo);

				} else {
					askWhoToPing(convo, `Whoops! Try *typing @ + the first few letters of the intended recipient’s first name*, like \`@matt\` , then clicking on the correct recipient`);
				}

				convo.next();

			}
		}
	])

}

function handlePingSlackUserIds(convo) {

	const { SlackUserId, tz, bot, pingSlackUserIds }  = convo.pingObject;

	if (pingSlackUserIds) {

		let pingSlackUserId              = pingSlackUserIds[0];
		convo.pingObject.pingSlackUserId = pingSlackUserId;

		models.User.find({
			where: { SlackUserId: pingSlackUserId },
		})
		.then((user) => {

			if (user) {

				const { SlackName, id } = user;
				convo.pingObject.pingUserId = id;

				// we will only handle 1
				if (pingSlackUserIds.length > 1) {
					convo.say(`Hey! Right now I only handle one recipient DM, so I'll be helping you with <@${user.dataValues.SlackUserId}>. Feel free to queue another message right after this!`);
				}

				// user found, handle the ping flow!
				user.getSessions({
					where: [ `"open" = ?`, true ],
					order: `"Session"."createdAt" DESC`
				})
				.then((sessions) => {

					let session = sessions[0];

					if (session) {
						// queue the message
						let { content, endTime } = session.dataValues;

						let now           = moment().tz(tz);
						let endTimeObject = moment(endTime).tz(tz);
						let endTimeString = endTimeObject.format("h:mma");
						let minutesLeft   = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());

						convo.say(`<@${user.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*`);
						convo.pingObject.userInSession = {
							user,
							endTimeObject
						};
						askForQueuedPingMessages(convo);

					} else {
						// send the message
						convo.say(`:point_left: <@${user.dataValues.SlackUserId}> is not a focused work session right now, so I started a conversation for you`);
						convo.say(`Thank you for being mindful of <@${user.dataValues.SlackUserId}>'s attention :raised_hands:`);
						convo.next();
					}

				});
				
			} else {
				// could not find user
				
				bot.api.users.info({ user: pingSlackUserId }, (err, response) => {
					if (!err) {
						const { user: { id, team_id, name, tz } } = response;
						let email = '';
						if (user.profile && user.profile.email) {
							email = user.profile.email
						};
						models.User.create({
							TeamId: team_id,
							email
							tz,
							SlackUserId: id,
							SlackName: name
						})
						.then(() => {
							handlePingSlackUserIds(convo);
						});
					} else {
						convo.say(`Sorry, I can't recognize that user!`);
						askWhoToPing(convo);
					}
				});

			}

			convo.next();

		});

	} else {
		startPingFlow(convo);
	}

}

function askForQueuedPingMessages(convo) {

	const { SlackUserId, bot, tz, userInSession }  = convo.pingObject;

	if (userInSession) {
		// we gathered appropriate info about user
		const { user, endTimeObject } = userInSession;
		const endTimeString = endTimeObject.format("h:mma");
		let now            = moment().tz(tz);
		let minutesLeft    = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());

		let text = `What would you like me to send <@${user.dataValues.SlackUserId}> at *${endTimeString}*?`;
		let attachments = [{
			text: "Enter as many lines as you’d like to include in the message then choose one of the send options when your message is ready to go\n(These few lines will delete after you type your first line and hit Enter :wink:)",
			attachment_type: 'default',
			callback_id: "PING_MESSAGE_LIST",
			fallback: "What is the message you want to queue up?"
		}];

		let requestMessages = [];

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsSendAt,
				callback: (response, convo) => {

					convo.pingObject.requestMessages = requestMessages;

					let text = '';

					// if date here, pre-fill it
					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
					if (customTimeObject) {

						if (now < customTimeObject && customTimeObject < endTimeObject) {

							convo.pingObject.pingTimeObject = customTimeObject;
							convo.pingObject.deliveryType   = "grenade";

						} else {

							let minutesBuffer = Math.round(minutesLeft / 4);
							now = moment().tz(tz);
							let exampleEndTimeObjectOne = now.add(minutesBuffer, 'minutes');
							now = moment().tz(tz);
							let exampleEndTimeObjectTwo = now.add(minutesLeft - minutesBuffer, 'minutes');
							convo.say(`The time has to be between now and ${endTimeString}. You can input times like \`${exampleEndTimeObjectOne.format("h:mma")}\` or \`${exampleEndTimeObjectTwo.format("h:mma")}\``);
							text = "When would you like to send your urgent message?";

						}
					}

					askForPingTime(convo, text);
					convo.next();

				}
			},
			{
				pattern: utterances.sendSooner,
				callback: (response, convo) => {

					convo.pingObject.requestMessages = requestMessages;

					askForPingTime(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

					requestMessages.push(response.text);

					let pingMessageListUpdate = getMostRecentMessageToUpdate(response.channel, bot, "PING_MESSAGE_LIST");
					if (pingMessageListUpdate) {

						attachments[0].actions = [
							{
								name: buttonValues.sendAtEndOfSession.name,
								text: `Send at ${endTimeString}`,
								value: `Send at ${endTimeString}`,
								type: `button`
							},
							{
								name: buttonValues.sendSooner.name,
								text: `:bomb: Send sooner :bomb:`,
								value: buttonValues.sendSooner.value,
								type: `button`
							}
						];

						attachments[0].text = requestMessages.length == 1 ? response.text : `${attachments[0].text}\n${response.text}`;

						pingMessageListUpdate.attachments = JSON.stringify(attachments);
						bot.api.chat.update(pingMessageListUpdate);

					}

				}
			}
		]);

	} else {
		startPingFlow(convo);
	}

}

function askForPingTime(convo, text = '') {

	const { SlackUserId, bot, tz, pingTimeObject, pingSlackUserId, userInSession }  = convo.pingObject;

	// if user is in a session and you have not set what time you want to ping yet
	if (!pingTimeObject && userInSession) {

		const { user, endTimeObject } = userInSession;

		let now            = moment().tz(tz);
		let minutesLeft    = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());
		let exampleEndTimeObject;
		if (minutesLeft > 10) {
			exampleEndTimeObject = now.add(minutesLeft - 10, 'minutes')
		} else {
			exampleEndTimeObject = now.add(Math.round(minutesLeft / 2), 'minutes');
		}
		
		let exampleEndTimeString = exampleEndTimeObject.format("h:mma");
		let endTimeString        = endTimeObject.format("h:mma");

		if (text == '') {
			text = `Would you like to send this urgent message now, or at a specific time before ${endTimeString}? If it’s the latter, just tell me the time, like \`${exampleEndTimeString}\``;
		}

		const attachments = [{
			attachment_type: 'default',
			callback_id: "PING_GRENADE",
			fallback: "When do you want to ping?",
			actions: [{
				name: buttonValues.now.name,
				text: `:bomb: Now :bomb:`,
				value: buttonValues.now.value,
				type: `button`
			}]
		}];

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsNow,
				callback: (response, convo) => {
					// send now
					convo.pingObject.deliveryType = "bomb";
					convo.say(`:point_left: Got it! I'll send your message to <@${user.dataValues.SlackUserId}> :runner: :pencil:`);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
					if (customTimeObject) {
						now = moment().tz(tz);
						if (now < customTimeObject && customTimeObject < endTimeObject) {
							// success!
							convo.pingObject.pingTimeObject = customTimeObject;
							convo.pingObject.deliveryType   = "grenade";
							convo.say(`Excellent! I’ll be sending your message to <@${user.dataValues.SlackUserId}> at *${customTimeObject.format("h:mma")}* :mailbox_open:`);
						} else {
							// has to be less than or equal to end time
							let minutesBuffer = Math.round(minutesLeft / 4);
							now = moment().tz(tz);
							let exampleEndTimeObjectOne = now.add(minutesBuffer, 'minutes');
							now = moment().tz(tz);
							let exampleEndTimeObjectTwo = now.add(minutesLeft - minutesBuffer, 'minutes');
							convo.say(`The time has to be between now and ${endTimeString}. You can input times like \`${exampleEndTimeObjectOne.format("h:mma")}\` or \`${exampleEndTimeObjectTwo.format("h:mma")}\``);
							askForPingTime(convo, "When would you like to send your urgent message?");
						}
							
					} else {

						convo.say(`I didn't quite get that :thinking_face:`);
						convo.repeat();

					}

					convo.next();

				}
			}
		]);

	}

	convo.next();

}
