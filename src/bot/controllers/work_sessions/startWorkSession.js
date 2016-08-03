import os from 'os';
import { wit } from '../index';
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
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {

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
			controller.trigger(`plan_command_center`, [ bot, config ]);
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

		const { SlackUserId, dailyTaskToWorkOn } = config;

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
					bot
				}

				if (dailyTaskToWorkOn) {
					convo.sessionStart.dailyTask = dailyTaskToWorkOn;
				} else {
					convo.say(`Hey! Time to start on a work session :smiley:`);
				}

				finalizeTimeAndTasksToStart(convo);
				convo.next();

				convo.on('end', (convo) => {

					closeOldRemindersAndSessions(user);

					setTimeout(() => {
						console.log("\n\n\n end of start session ");
						console.log(convo.sessionStart);
						console.log("\n\n\n");
						startSessionWithConvoObject(convo.sessionStart);
					}, 1000);

				})
			
			});

		});
	});

}

