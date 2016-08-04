import os from 'os';
import { wit, bots } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertMinutesToHoursString, convertStringToNumbersArray } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, closeOldRemindersAndSessions } from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, startSessionOptionsAttachments, constants } from '../../lib/constants';

import { resumeQueuedReachouts } from '../index';

import { finalizeTimeAndTasksToStart, startSessionWithConvoObject } from '../modules/startWorkSessionFunctions';

// START OF A WORK SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to start a session
	 * 							~* via Wit *~
	 * 		     this makes sure you are properly in
	 * 		     				in a "SessionGroup" before
	 * 		     			working on your session
	 */
	controller.hears(['start_session', 'is_back'], 'direct_message', wit.hears, (bot, message) => {

		const { intentObject: { entities: { intent } } } = message;
		let sessionIntent;
		if (intent && intent.length > 0) {
			sessionIntent = intent[0].value;
		}

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		let config = {
			planDecision: constants.PLAN_DECISION.work.word,
			SlackUserId,
			message
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [ models.SlackUser ]
			}).then((user) => {

				const name = user.nickName || user.email;

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						convo.say(`Welcome back, ${name}!`);
					} else {
						convo.say(" ");
					}
					convo.next();
					convo.on('end', (convo) => {
						controller.trigger(`plan_command_center`, [ bot, config ]);
					})
				});

			});
		}, 750);

	});

	/**
	 * 		ACTUAL START SESSION FLOW
	 * 		this will begin the start_session flow with user
	 *
	 * 			- start work session
	 * 			- show and decide tasks to work on
	 * 			- decide session duration
	 */
	controller.on('begin_session', (bot, config) => {

		const { SlackUserId, dailyTaskToWorkOn, currentSession } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			// need user's timezone for this flow!
			const { SlackUser: { tz } } = user;
			const UserId = user.id;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.sessionStart = {
					SlackUserId,
					UserId,
					tz,
					bot,
					currentSession
				}

				if (dailyTaskToWorkOn) {
					convo.sessionStart.dailyTask = dailyTaskToWorkOn;
				} else {
					convo.say(`Let's do it :punch:`);
				}

				finalizeTimeAndTasksToStart(convo);
				convo.next();

				convo.on('end', (convo) => {

					const { sessionStart } = convo;

					console.log("\n\n\n end of start session ");
					console.log(sessionStart);
					console.log("\n\n\n");

					if (sessionStart.confirmStart) {
						closeOldRemindersAndSessions(user);
						setTimeout(() => {
							startSessionWithConvoObject(convo.sessionStart);
						}, 500);
					} else {
						setTimeout(() => {
							resumeQueuedReachouts(bot, { SlackUserId });
						}, 750);
					}

				})
			
			});

		});
	});

}

