import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, tokiOptionsExtendedAttachment, intentConfig } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, deleteConvoAskMessage } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';

export default function(controller) {
	
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

			if (!user) {
				console.log(`USER NOT FOUND: ${SlackUserId}`);
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				if (!convo) {
					console.log("convo not working\n\n\n");
					return;
				}

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
							controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
							break;
						default: 
							resumeQueuedReachouts(bot, { SlackUserId });
							break;
					}

				});

			})

		});

	});

}

function startOnBoardConversation(err, convo) {
	
	const { name } = convo;

	convo.say(`Hey, ${name}! My name is Toki and I'm your personal sidekick to win each day`);
	askForUserName(err, convo);
}

function askForUserName(err, convo) {

	const { name, task: { bot } } = convo;

	convo.ask({
		text: `Before we begin, would you like me to call you *${name}* or another name?`,
		attachments: [
			{
				text: "*_psst, if you don’t want to click buttons, type the button’s message and I’ll pick it up :nerd_face:_*",
				"mrkdwn_in": [
					"text"
				],
				attachment_type: 'default',
				callback_id: "ONBOARD",
				fallback: "What's your name?",
				color: colorsHash.blue.hex,
				actions: [
					{
						name: buttonValues.keepName.name,
						text: `Keep my name!`,
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
			pattern: utterances.containsKeep,
			callback: (response, convo) => {
				convo.onBoard.nickName = name;
				askForTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.containsDifferentOrAnother,
			callback: (response, convo) => {
				convo.say("Okay!");
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

function askCustomUserName(response, convo) {

	convo.ask("What would you like me to call you?", (response, convo) => {
		convo.onBoard.nickName = response.text;
		askForTimeZone(response, convo);
		convo.next();
	});

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

function askForTimeZone(response, convo) {

	const { nickName } = convo.onBoard;

	const { task: { bot } } = convo;

	convo.say({
		text: `Nice to virtually meet you, ${nickName}! Here's how I help you win the day :trophy::`,
		attachments: tokiOptionsAttachment
	});

	convo.ask({
		text: `Since I help you make time for these outcomes, I need to know which *timezone* you are in!`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "ONBOARD",
				fallback: "What's your timezone?",
				color: colorsHash.grey.hex,
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
			pattern: utterances.eastern,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.eastern;
				startNewPlanFlow(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.central,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.central;
				startNewPlanFlow(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.mountain,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.mountain;
				startNewPlanFlow(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.pacific,
			callback: (response, convo) => {
				convo.onBoard.timeZone = timeZones.pacific;
				startNewPlanFlow(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.other,
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

function startNewPlanFlow(response, convo) {

	const { timeZone: { tz, name } } = convo.onBoard;

	convo.say(`Awesome, I have you in the *${name}* timezone! Now let's win our first day together :grin:`);
	convo.onBoard.postOnboardDecision = intentConfig.START_DAY;
	convo.next();
}

/**
 * 		Currently these functions are deprecated
 */
function askOtherTimeZoneOptions(response, convo) {

	convo.say("As a time-based sidekick, I need to have your timezone to be effective");
	convo.say("Right now I only support the timezones listed above; I will let you know as soon as I support other ones");
	convo.say("If you're ever in a timezone I support, just say `settings` to update your timezone!");
	convo.onBoard.timeZone = timeZones.eastern;
	displayTokiOptions(response, convo);

	// convo.ask("What is your timezone?", (response, convo) => {

	// 	var timezone = response.text;
	// 	if (false) {
	// 		// functionality to try and get timezone here
			
	// 	} else {
	// 		convo.say("I'm so sorry, but I don't support your timezone yet for this beta phase, but I'll reach out when I'm ready to help you work");
	// 		convo.stop();
	// 	}

	// 	convo.next();

	// });

	convo.next();

}

function confirmTimeZone(response, convo) {

	const { timeZone: { tz, name } } = convo.onBoard;
	const { task: { bot } } = convo;

	convo.ask({
		text: `I have you in the *${name}* timezone!`,
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
						text: `No, that's not right!`,
						value: buttonValues.thatsIncorrect.value,
						type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say(`Oops, okay!`);
				askForTimeZone(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.yesOrCorrect,
			callback: (response, convo) => {
				convo.say("Fantastic! Let's get started with your first plan :grin:");
				convo.onBoard.postOnboardDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // everything else other than that's incorrect or "no" should be treated as yes
			default: true,
			callback: (response, convo) => {
				convo.say("Fantastic! Let's get started with your first plan :grin:");
				convo.onBoard.postOnboardDecision = intentConfig.START_DAY;
				convo.next();
			}
		}
	]);

}

function displayTokiOptions(response, convo) {

	convo.say(`You can always change your timezone and name by telling me to \`show settings\``);
	convo.say({
		text: "As your personal sidekick, I can help you with your time by:",
		attachments: tokiOptionsAttachment
	});
	convo.say("If you want to see how I specifically assist you to make the most of each day, just say `show commands`. Otherwise, let's move on!");
	askUserToStartDay(response, convo);

	convo.next();

}

// end of convo, to start day
function askUserToStartDay(response, convo) {
	convo.ask("Please tell me to `start the day!` so we can plan our first day together :grin:",
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

	convo.say("I had a feeling you'd do that!");
	convo.say("First off, you can call me `hey toki!` at any point in the day and I'll be here to help you get in flow :raised_hands:")
	convo.say({
		text: "Here are more specific things you can tell me to help you with:",
		attachments: tokiOptionsExtendedAttachment
	});
	convo.say("I'm getting smart in understanding what you want, so the specific commands above are guidlines. I'm able to understand related commands :smile_cat:");
	convo.say("I also have two shortline commands that allow you to quickly add tasks `/add send email marketing report for 30 minutes` and quickly set reminders `/note grab a glass of water at 3:30pm`");
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
