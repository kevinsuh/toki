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
						startTask: {
							index: 0, // fail-safe default. should get updated in flow
							minutes: 30 // fail-safe default. should get updated in flow
						},
						startTime: false // default will be now
					}

					let day = moment().tz(tz).format('dddd');
					convo.say(`Happy ${day}, ${name}! Let's win the ${daySplit} :muscle:`);

					if (sessionGroups.length == 0) {
						convo.newPlan.autoWizard = true;
					}

					startNewPlanFlow(convo);

					// on finish conversation
					convo.on('end', (convo) => {

						const { newPlan } = convo;
						let { prioritizedTasks, startTask, startTime } = newPlan;

						closeOldRemindersAndSessions(user);

						// we only know minutes information of first task
						startTask.taskObject = {
							...prioritizedTasks[startTask.index],
							minutes: startTask.minutes
						};

						prioritizedTasks.splice(startTask.index, 1);
						prioritizedTasks.unshift(startTask.taskObject); // put this in first

						// first turn off all existing daily tasks
						user.getDailyTasks({
							where: [`"DailyTask"."type" = ?`, "live"]
						})
						.then((dailyTasks) => {
							let dailyTaskIds = dailyTasks.map(dailyTask => dailyTask.id);
							if (dailyTaskIds.length == 0) {
								dailyTaskIds = [0]
							};
							models.DailyTask.update({
								type: "archived"
							}, {
								where: [ `"DailyTasks"."id" IN (?)`, dailyTaskIds ]
							})
							.then((dailyTasks) => {
								prioritizedTasks.forEach((task, index) => {
									const priority = index + 1;
									const { text, minutes } = task;
									models.Task.create({
										text
									})
									.then((task) => {
										task.createDailyTask({
											minutes,
											priority,
											UserId
										});
									})
								});
							});
						})

						if (startTime) {
							// when the reminder comes, it will ask for the highest priority
							// task that is not done yet. right now schema is: when user
							// decides to work on something else, it will put that as highest 
							// priorty. does highest priority mean doing it first?
							models.Reminder.create({
								UserId,
								remindTime: startTime,
								type: "start_work"
							})
						}



						console.log("here is new plan object:\n");
						console.log(convo.newPlan);
						console.log("\n\n\n");

						setTimeout(() => {
							resumeQueuedReachouts(bot, { SlackUserId });
						}, 1250);

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
