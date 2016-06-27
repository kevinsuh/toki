import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

export default function(controller) {
	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		console.log("\n\n\n ~~ in back up area!!! ~~ \n\n\n");
		console.log(message);

		var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(() => {

				// different fallbacks based on reg exp
				const { text } = message;

				if (THANK_YOU.reg_exp.test(text)) {
					// user says thank you
					bot.reply(message, "You're welcome!! :smile:");
				} else if (SECRET_KEY.test(text)) {

					console.log("\n\n ~~ UNLOCKED TOKI T1ME ~~ \n\n");

					console.log(" message being passed in:");
					console.log(message);
					console.log("\n\n\n");

					/*
							
			*** ~~ TOP SECRET PASSWORD FOR TESTING FLOWS ~~ ***
							
					 */
					controller.trigger(`begin_onboard_flow`, [ bot, { SlackUserId } ]);

				} else {
					// end-all fallback
					var options = [ { title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
					var colorsArrayLength = colorsArray.length;
					var optionsAttachment = options.map((option, index) => {
						var colorsArrayIndex = index % colorsArrayLength;
						return {
							fields: [
								{
									title: option.title,
									value: option.description
								}
							],
							color: colorsArray[colorsArrayIndex].hex,
							attachment_type: 'default',
							callback_id: "SHOW OPTIONS",
							fallback: option.description
						};
					});

					bot.reply(message, {
						text: "Hey! I can only help you with a few things. Here's the list of things I can help you with:",
						attachments: optionsAttachment
					});
				}

			}, 1000);

		}

	});

	/**
	 *      ONBOARD FLOW
	 */

	controller.on('begin_onboard_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.onBoard = {
					SlackUserId
				}

				startOnBoardConversation(err, convo);

				convo.on('end', (convo) => {

					console.log("\n\n ~~ at end of convo onboard! ~~ \n\n");
					console.log(convo.onBoard);

					const { SlackUserId, nickName, timeZone } = convo.onBoard;

					if (timeZone) {
						const { tz } = timeZone;

						user.SlackUser.update({
							tz
						});

					}

					if (nickName) {

						user.update({
							nickName
						});

					}

				});

			})

		});

	});

}

function startOnBoardConversation(err, convo) {
	
	const { name } = convo;

	convo.say(`Hey ${name}! Thanks for inviting me to help you make the most of your time each day`);
	convo.say("Before I explain how I work, let's make sure I have two crucial details: your name and your timezone!");
	askForUserName(err, convo);
}

function askForUserName(err, convo) {

	const { name } = convo;

	convo.ask({
		text: `Would you like me to call you ${name} or another name?`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "ONBOARD",
				fallback: "What's your name?",
				color: colorsHash.blue.hex,
				actions: [
					{
						name: buttonValues.keepName.name,
						text: `Call me ${name}!`,
						value: buttonValues.keepName.value,
						type: "button"
					},
					{
						name: buttonValues.differentName.name,
						text: `Another name`,
						value: buttonValues.differentName.value,
						type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: buttonValues.keepName.value,
			callback: (response, convo) => {
				confirmUserName(name, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.differentName.value,
			callback: (response, convo) => {
				askCustomUserName(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				confirmUserName(response.text, convo);
				convo.next();
			}
		}
	]);


}

function confirmUserName(name, convo) {

	convo.ask(`So you'd like me to call you *${name}*?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.onBoard.nickName = name;
				askForTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				askCustomUserName(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("Sorry, I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);

}

function askCustomUserName(response, convo) {

	convo.ask("What would you like me to call you?", (response, convo) => {
		confirmUserName(response.text, convo);
		convo.next();
	});

}

function askForTimeZone(response, convo) {

	const { nickName } = convo.onBoard;

	convo.say(`I really like the name *${nickName}*!`);
	convo.ask({
		text: `Now which *timezone* are you in?`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "ONBOARD",
				fallback: "What's your timezone?",
				color: colorsHash.blue.hex,
				actions: [
					{
						name: buttonValues.timeZones.eastern.name,
						text: `Eastern`,
						value: buttonValues.timeZones.eastern.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.central.name,
						text: `Central`,
						value: buttonValues.timeZones.central.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.mountain.name,
						text: `Mountain`,
						value: buttonValues.timeZones.mountain.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.pacific.name,
						text: `Pacific`,
						value: buttonValues.timeZones.pacific.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.other.name,
						text: `Other`,
						value: buttonValues.timeZones.other.value,
						type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: buttonValues.timeZones.eastern.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.eastern;
				displayTokiOptions(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.central.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.central;
				displayTokiOptions(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.mountain.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.mountain;
				displayTokiOptions(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.pacific.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.pacific;
				displayTokiOptions(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.other.value,
			callback: (response, convo) => {
				askOtherTimeZoneOptions(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("I didn't get that :thinking_face");
				convo.repeat();
				convo.next();
			}
		}
	]);

}

// for now we do not provide this
function askOtherTimeZoneOptions(response, convo) {

	convo.say("As Toki the Time Fairy, I need to get this right :grin:");
	convo.ask("What is your timezone?", (response, convo) => {

		var timezone = response.text;
		if (false) {
			// functionality to try and get timezone here
			
		} else {
			convo.say("I'm so sorry, but I don't support your timezone yet for this beta phase, but I'll reach out when I'm ready to help you work");
			convo.stop();
		}

		convo.next();

	});

	convo.next();

}

function confirmTimeZone(response, convo) {

}

function displayTokiOptions(response, convo) {

	const { timeZone: { tz, name } } = convo.onBoard;

	convo.say(`I now have you in *${name}* timezone. You can change settings like your current timezone and name by telling me to \`show settings\``);
	convo.say({
		text: "As your personal sidekick, I can help you with your time by:",
		attachments: tokiOptionsAttachment
	});
	convo.say("The specific commands above, like `start my day` are guidelines - I'm able to understand other related commands");
	convo.say("Tell me `let's start the day, Toki!` or something like that to see this in action :grin:");
	convo.next();

	// END OF CONVERSATION

}


function TEMPLATE_FOR_TEST(bot, message) {

	const SlackUserId = message.user;

	models.User.find({
		where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
		include: [
			models.SlackUser
		]
	}).then((user) => {

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			var name = user.nickName || user.email;

			// on finish convo
			convo.on('end', (convo) => {
				
			});

		});
	});
}
