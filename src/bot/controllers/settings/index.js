import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, getSettingsAttachment } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';

// user wants to update settings!
export default function(controller) {

	controller.hears(['settings'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		var config = { SlackUserId };

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`settings_flow`, [ bot, config ]);
		}, 550);

	});

	/**
	 *      SETTINGS FLOW
	 */

	controller.on('settings_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			user.SlackUser.getIncluded({
				include: [ models.User ]
			})
			.then((includedSlackUsers) => {

				console.log(`\n\n included slack users: \n\n`);
				console.log(includedSlackUsers);

				const { nickName, defaultSnoozeTime, defaultBreakTime, wantsPing, pingTime, includeOthersDecision, SlackUser: { tz } } = user;
				var userTimeZone = {};
				for (var key in timeZones) {
					if (timeZones[key].tz == tz) {
						userTimeZone = timeZones[key];
					}
				}

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					var name   = user.nickName || user.email;
					convo.name = name;

					convo.settings = {
						SlackUserId,
						timeZone: userTimeZone,
						nickName: name,
						defaultBreakTime,
						defaultSnoozeTime,
						wantsPing,
						pingTime,
						includeOthersDecision,
						includedSlackUsers
					}

					convo.say(`Hello, ${name}!`);
					settingsHome(convo);
					convo.next();

					convo.on('end', (convo) => {

						consoleLog("end of settings for user!!!!", convo.settings);

						const { SlackUserId, nickName, timeZone, defaultBreakTime, defaultSnoozeTime } = convo.settings;

						// if (timeZone) {
						// 	const { tz } = timeZone;
						// 	user.SlackUser.update({
						// 		tz
						// 	});
						// }

						// if (nickName) {
						// 	user.update({
						// 		nickName
						// 	});
						// }

						// if (defaultSnoozeTime) {
						// 	user.update({
						// 		defaultSnoozeTime
						// 	})
						// }

						// if (defaultBreakTime) {
						// 	user.update({
						// 		defaultBreakTime
						// 	})
						// }

						resumeQueuedReachouts(bot, { SlackUserId });

					});
				})
			});
		});
	});
}

// the home view of user's settings
function settingsHome(convo) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	const { task }                = convo;
	const { bot, source_message } = task;

	let text = `Here are your settings:`;
	let attachments = getSettingsAttachment(settings);
	convo.say({
		text,
		attachments
	});

	askWhichSettingsToUpdate(convo);


}

function askWhichSettingsToUpdate(convo, text = false) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	const { task }                = convo;
	const { bot, source_message } = task;

	if (!text)
		text = `Which of these settings would you like me to update?`

	convo.ask({
		text,
		attachments: [{
			callback_id: "UPDATE_SETTINGS",
			fallback: `Would you like to update a settings?`,
			color: colorsHash.grey.hex,
			attachment_type: 'default',
			actions: [
				{
					name: buttonValues.neverMind.name,
					text: "Good for now!",
					value: buttonValues.neverMind.value,
					type: "button"
				}
			]
		}]
	}, [
		{ // change name
			pattern: utterances.containsName,
			callback: (response, convo) => {
				convo.say(`CHANGING NAME`);
				convo.next();
			}
		},
		{ // change timeZone
			pattern: utterances.containsTimeZone,
			callback: (response, convo) => {
				convo.say(`CHANGING TIMEZONE`);
				convo.next();
			}
		},
		{ // change morning ping
			pattern: utterances.containsPing,
			callback: (response, convo) => {
				convo.say(`CHANGING PING`);
				convo.next();
			}
		},
		{ // change extend duration
			pattern: utterances.containsExtend,
			callback: (response, convo) => {
				convo.say(`CHANGING EXTEND`);
				convo.next();
			}
		},
		{ // change break duration
			pattern: utterances.containsBreak,
			callback: (response, convo) => {
				convo.say(`CHANGING BREAK`);
				convo.next();
			}
		},
		{ // change priority sharing
			pattern: utterances.containsPriority,
			callback: (response, convo) => {
				convo.say(`CHANGING PRIORITY`);
				convo.next();
			}
		},
		{
			// no or never mind to exit this flow
			pattern: utterances.containsNoOrNeverMindOrNothing,
			callback: (response, convo) => {
				convo.say(`Okay! Let me know whenever you want to \`edit settings\``);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				const text = "Sorry, I didn't get that. Which specific settings would you like to update? `i.e. morning ping`";
				askWhichSettingsToUpdate(convo, text);
				convo.next();
			}
		}
	]);

}