import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, tokiOptionsExtendedAttachment } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

export default function(controller) {

	controller.hears([THANK_YOU.reg_exp], 'direct_message', (bot, message) => {
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "You're welcome!! :smile:");
		}, 500);
	})

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		consoleLog("in back up area!!!", message);

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

					consoleLog("UNLOCKED TOKI_T1ME!!!");
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

				resumeQueuedReachouts(bot, { SlackUserId });

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
					SlackUserId,
					postOnboardDecision: false
				}

				startOnBoardConversation(err, convo);

				convo.on('end', (convo) => {

					consoleLog("end of onboard for user!!!!", convo.onBoard);

					const { SlackUserId, nickName, timeZone, postOnboardDecision } = convo.onBoard;

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

					switch (postOnboardDecision) {
						case intentConfig.START_DAY:
							controller.trigger(`begin_day_flow`, [ bot, { SlackUserId }]);
							break;
						default: break;
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
				convo.onBoard.nickName = name;
				convo.say(`I really like the name *${name}*!`);
				askForTimeZone(response, convo);
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
				convo.say(`I really like the name *${name}*!`);
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

	convo.ask({
		text: `Which *timezone* are you in?`,
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
				confirmTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.central.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.central;
				confirmTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.mountain.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.mountain;
				confirmTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.pacific.value,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.pacific;
				confirmTimeZone(response, convo);
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
				convo.say("I didn't get that :thinking_face:");
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

	const { timeZone: { tz, name } } = convo.onBoard;

	convo.say(`I have you in the *${name}* timezone!`);
	convo.ask({
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "ONBOARD",
				fallback: "What's your timezone?",
				actions: [
					{
						name: buttonValues.thatsCorrect.name,
						text: `That's correct :+1:`,
						value: buttonValues.thatsCorrect.value,
						type: "button",
						style: "primary"
					},
					{
						name: buttonValues.thatsIncorrect.name,
						text: `Wait, that's not right!`,
						value: buttonValues.thatsIncorrect.value,
						type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: buttonValues.thatsIncorrect.value,
			callback: (response, convo) => {
				askForTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say(`Oops, okay!`);
				askForTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.thatsCorrect.value,
			callback: (response, convo) => {
				displayTokiOptions(response, convo);
				convo.next();
			}
		},
		{ // everything else other than that's incorrect or "no" should be treated as yes
			default: true,
			callback: (response, convo) => {
				convo.say(`Fantastic!`);
				displayTokiOptions(response, convo);
				convo.next();
			}
		}
	]);

}

function displayTokiOptions(response, convo) {

	convo.say(`You can change settings like your current timezone and name by telling me to \`show settings\``);
	convo.say({
		text: "As your personal sidekick, I can help you with your time by:",
		attachments: tokiOptionsAttachment
	});
	convo.say("I'll walk you through you how I can assist you to make the most of each day (but if you ever want to see all the things I can help you with, just say `show commands`!)");

	askUserToStartDay(response, convo);

	convo.next();

}

// end of convo, to start day
function askUserToStartDay(response, convo) {
	convo.ask("Please tell me `let's start the day, Toki!` to plan our first day together :grin:",
	[
		{
			pattern: utterances.containsSettings,
			callback: (response, convo) => {
				convo.say("Okay, let's configure these settings again!");
				askForUserName(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.containsShowCommands,
			callback: (response, convo) => {
				showCommands(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.containsStartDay,
			callback: (response, convo) => {
				convo.say("Let's do this :grin:");
				convo.onBoard.postOnboardDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ 
			default: true,
			callback: (response, convo) => {
				convo.say(`Well, this is a bit embarrassing. Say \`start the day\` to keep moving forward so I can show you how I can help you work`);
				convo.repeat();
				convo.next();
			}
		}
	]);
}

// show the more complex version of commands
function showCommands(response, convo) {

	convo.say({
		text: "I had a feeling you'd do that! Here are the different types of items you can tell me to help you with:",
		attachments: tokiOptionsExtendedAttachment
	});
	convo.say("The specific commands above, like `start my day` are guidelines - I'm able to understand other related commands, like `let's start the day` :smiley:");
	convo.say("I can also understand more complicated reminders, like `remind me to grab a glass of water in 5 min` to set a reminder to grab a glass of water for a time 5 minutes from now or `remind me to drink the glass of water at 9am` to set a reminder to grab drink the glass of water at 9am!");
	askUserToStartDay(response, convo);
	convo.next();

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
