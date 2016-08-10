import os from 'os';
import { wit, resumeQueuedReachouts } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, constants } from '../../lib/constants';
import { convertArrayToTaskListMessage, convertTimeStringToMinutes, commaSeparateOutTaskArray,convertMinutesToHoursString, } from '../../lib/messageHelpers';

import { witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray } from '../../lib/miscHelpers';

// this one shows the task list message and asks for options
export function startEndPlanConversation(convo) {

	const { dayEnd: { wonDay } } = convo;

	if (wonDay) {
		startWonDayConversation(convo);
	} else {
		startDidNotWinDayConversation(convo);
	}

}

// user has won the day!
function startWonDayConversation(convo) {

	const { dayEnd: { dailyTasks } } = convo;

	let completedDailyTasks = [];
	let minutesWorked       = 0;
	dailyTasks.forEach((dailyTask) => {
		if (dailyTask.Task.done) {
			completedDailyTasks.push(dailyTask);
		}
		minutesWorked += dailyTask.dataValues.minutesSpent;
	});

	let timeWorkedString = convertMinutesToHoursString(minutesWorked);

	let options = { reviewVersion: true, calculateMinutes: true, noTitles: true };
	let completedTaskListMessage  = convertArrayToTaskListMessage(dailyTasks, options);

	convo.say(`Congratulations on winning the day! It’s all about time well spent, and today you did just that :trophy:`);
	convo.say(completedTaskListMessage);

}

// user has not won the day!
function startDidNotWinDayConversation(convo) {

}