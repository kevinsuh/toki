import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { } from '../../lib/messageHelpers';
import { getCurrentDaySplit, closeOldRemindersAndSessions } from '../../lib/miscHelpers';
import { constants, dateOfNewPlanDayFlow } from '../../lib/constants';

import { startNewPlanFlow } from '../modules/plan';

/**
 * Starting a new plan for the day
 */

import { resumeQueuedReachouts } from '../index';

// base controller for new plan
export default function(controller) {

	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{
			controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
		}, 1000);

	});

	/**
	* 	~ NEW PLAN FOR YOUR DAY ~
	* 	1) get your 3 priorities
	* 	2) make it easy to prioritize in order for the day
	* 	3) enter work sessions for each of them
	*/

	controller.on('new_plan_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { SlackUser: { tz } } = user;

			let daySplit = getCurrentDaySplit(tz);

			user.getSessionGroups({
				where: [ `"SessionGroup"."type" = ? AND "SessionGroup"."createdAt" > ?`, "start_work", dateOfNewPlanDayFlow],
				limit: 1
			})
			.then((sessionGroups) => {

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					var name   = user.nickName || user.email;
					convo.name = name;

					convo.newPlan = {
						tz,
						daySplit,
						autoWizard: false,
						prioritizedTasks: [],
						startTaskIndex: false
					}

					let day = "day";
					if (daySplit != constants.MORNING.word) {
						day = daySplit;
					}
					convo.say(`Hey ${name}! Let's win the ${daySplit} :muscle:`);

					if (sessionGroups.length == 0) {
						convo.newPlan.autoWizard = true;
					}

					startNewPlanFlow(convo);

					// on finish conversation
					convo.on('end', (convo) => {

						const { newPlan } = convo;

						console.log('done!')
						console.log("here is new plan object:\n\n\n");
						console.log(convo.newPlan);
						console.log("\n\n\n");

						closeOldRemindersAndSessions(user);

						setTimeout(() => {
							resumeQueuedReachouts(bot, { SlackUserId });
						}, 750);

						// placeholder for keep going
						if (newPlan) {

						} else {
							// default premature end
							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
								resumeQueuedReachouts(bot, { SlackUserId });
								convo.say("Okay! Let me know when you want to plan for today");
								convo.next();
							});
						}

					});

				});
			})

				

		})

	});

}
