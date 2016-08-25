import { wit } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';
import { sendPing } from '../pings/pingFunctions';

export default function(controller) {

	/**
	 *      SLASH COMMAND FLOW
	 */
	controller.on('slash_command', (bot, message) => {

		console.log(message);

		const { team_id, user_id } = message;
		let text = message.text.trim();

		const SlackUserId = message.user;
		let env           = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev","");
		}

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			const { SlackName, tz } = user;
			const UserId = user.id;

			// make sure verification token matches!
			if (message.token !== process.env.VERIFICATION_TOKEN) {
				console.log(`\n ~~ verification token could not be verified ~~ \n`)
				return;
			}

			const { intentObject: { entities: { reminder, duration, datetime } } } = message;

			let now = moment().tz(tz);
			let responseObject = {
				response_type: "ephemeral"
			}
			let slackNames = getUniqueSlackUsersFromString(text, { normalSlackNames: true });
			let customTimeObject;

			let toSlackName = slackNames.length > 0 ? slackNames[0] : false;

			switch (message.command) {
				case "/focus":

					customTimeObject = witTimeResponseToTimeZoneObject(message, tz);

					if (customTimeObject) {

						// quick adding a reminder requires both text + time!
						models.Reminder.create({
							remindTime: customTimeObject,
							UserId,
							customNote
						})
						.then((reminder) => {
							let customTimeString = customTimeObject.format('h:mm a');
							let responseText = `Okay, I'll remind you at ${customTimeString}`;
							if (customNote) {
								responseText = `${responseText} about \`${customNote}\``;
							}
							responseText = `${responseText}! :alarm_clock:`;
							responseObject.text = responseText;
							bot.replyPublic(message, responseObject);
						});

					} else {
						let responseText = '';
						if (customNote) {
							responseText = `Hey, I need to know what time you want me to remind you about \`${text}\` (please say \`${text} in 30 min\` or \`${text} at 7pm\`)!`;
						} else {
							responseText = `Hey, I need to know when you want me to remind you \`i.e. pick up clothes at 7pm\`!`;
						}
						responseObject.text = responseText;
						bot.replyPublic(message, responseObject);
					}

					let responseText = 'HELLO WORLD';
					responseObject.text = responseText;
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
							const toUserConfig   = { UserId: toUser.dataValues.UserId, SlackUserId: toUser.dataValues.SlackUserId }
							sendPing(bot, fromUserConfig, toUserConfig, config);

						})

					} else {
						responseObject.text = `Let me know who you want to send this ping to! (i.e. \`@emily\`)`;
						bot.replyPrivate(message, responseObject);
					}

					break;

				case "/explain":
					responseObject.text = `Okay I just explained how this works!`;
					bot.replyPrivate(message, responseObject);
					break;
				default:
					responseObject.text = `I'm sorry, still learning how to \`${message.command}\`! :dog:`;
					bot.replyPrivate(message, responseObject);
					break;
			}


		});

	});

}
