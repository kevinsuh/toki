import os from 'os';
import { wit, bots } from '../index';
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
		let botToken = bot.config.token;
		bot          = bots[botToken];

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

	convo.say(`Hey, ${name}! My name is Toki and I'm here to help you win each day by accomplishing your top 3 priorities`);
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
				explainTokiBenefits(convo);
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
		explainTokiBenefits(convo);
		convo.next();
	});

}

function confirmUserName(name, convo) {

	convo.ask(`So you'd like me to call you *${name}*?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.onBoard.nickName = name;
				explainTokiBenefits(convo);
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

function explainTokiBenefits(convo) {

	const { nickName }      = convo.onBoard;
	const { task: { bot } } = convo;

	let text = `Nice to virtually meet you, ${nickName}!`;
	convo.say(text);
	text = `:trophy: Here's how I help you win each day :trophy:`;
	let attachments = [{
		text: `Instead of treating each day as a never-ending list of todos, I’m here to help you identify the *top 3 priorities* that actually define your day, *_and accomplish them_*`,
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		"mrkdwn_in": [ "text" ],
		color: colorsHash.salmon.hex,
		actions: [
			{
				name: buttonValues.next.name,
				text: "Why three?",
				value: buttonValues.next.value,
				type: "button"
			}
		]
	}];

	convo.ask({
		text,
		attachments
	}, (response, convo) => {

		attachments[0].text = `I realize you’ll likely be working on more than three tasks each day. My purpose isn’t to help you get a huge list of things done. I’m here to make sure you get *3 higher level priorities done that are critically important to your day, but might get lost or pushed back* if you don’t deliberately make time for them`
		attachments[0].actions[0].text = `What else?`;
		attachments[0].color = colorsHash.blue.hex;

		convo.ask({
			attachments
		}, (response, convo) => {
			
			attachments[0].text = `I can also send your priorities to anyone on your team if you’d like to ​*share what you’re working on*`
			attachments[0].actions[0].text = `Let's do this!`;
			attachments[0].color = colorsHash.yellow.hex;

			convo.ask({
				attachments
			}, (response, convo) => {

				askForTimeZone(response, convo)
				convo.next();

			});

			convo.next();

		});

		convo.next();

	});

}

function askForTimeZone(response, convo) {

	const { nickName } = convo.onBoard;

	const { task: { bot } } = convo;

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

function askOtherTimeZoneOptions(response, convo) {

	convo.say("As a time-based sidekick, I need to have your timezone to be effective");
	convo.say("I’m only able to work in these timezones right now. If you want to demo Toki, just pick one of these timezones. I’ll try to get your timezone included as soon as possible!");
	askForTimeZone(response, convo);
	convo.next();

}

function startNewPlanFlow(response, convo) {

	const { timeZone: { tz, name } } = convo.onBoard;

	convo.say(`Awesome, I have you in the *${name}* timezone! Now let's win the day :grin:`);
	convo.onBoard.postOnboardDecision = intentConfig.START_DAY;
	convo.next();

}
