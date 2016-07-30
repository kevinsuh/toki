import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, tokiOptionsExtendedAttachment, ANY_CHARACTER } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, deleteConvoAskMessage } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

export default function(controller) {

	controller.hears([THANK_YOU.reg_exp], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "You're welcome!! :smile:");
			resumeQueuedReachouts(bot, { SlackUserId });
		}, 500);
	});

	controller.hears([ANY_CHARACTER.reg_exp], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
			resumeQueuedReachouts(bot, { SlackUserId });
		}, 500);
	});

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

		if (message.text && message.text[0] == "/") {
			// ignore all slash commands
			console.log("\n\n ~~ ignoring a slash command ~~ \n\n");
			return;
		}

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
						text: "Hey! I'm here to help you with your 3 priorities for today. Let me know when you want to get started."
					});

				}

				resumeQueuedReachouts(bot, { SlackUserId });

			}, 1000);

		}

	});

}