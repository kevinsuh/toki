import os from 'os';
import { wit } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

// this one shows the task list message and asks for options
export function startEditTaskListMessage(convo) {

	const { dailyTasks } = convo.tasksEdit;

	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	convo.say("Here are your tasks for today :memo::");
	convo.say(taskListMessage);
	convo.next();

}