'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startNewPlanFlow = startNewPlanFlow;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _constants = require('../../lib/constants');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		NEW PLAN CONVERSATION FLOW FUNCTIONS
 */

function startNewPlanFlow(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan = convo.newPlan;
	var SlackUserId = _convo$newPlan.SlackUserId;
	var daySplit = _convo$newPlan.daySplit;
	var onboardVersion = _convo$newPlan.onboardVersion;

	convo.newPlan.prioritizedTasks = [];

	var contextDay = "today";
	if (daySplit != _constants.constants.MORNING.word) {
		contextDay = 'this ' + daySplit;
	}

	var question = 'Let’s win ' + contextDay + '! What are up to 3 priorities you want to work toward today? These are the important outcomes that you want to put time toward achieving today, not necessarily specific tasks you want to check off your todo list';
	if (onboardVersion) {
		question = question + ' Please enter each one in a separate message';
	}

	addPriorityToList(convo);
}

// function to add a priority to your plan
// this dynamically handles 1st, 2nd, 3rd priorities
function addPriorityToList(convo) {
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var count = prioritizedTasks.length;
	var countString = '';
	var actions = [];

	switch (count) {
		case 0:
			countString = 'first';
			break;
		case 1:
			countString = 'second';
			actions = [{
				name: _constants.buttonValues.newPlan.noMorePriorities.name,
				text: "No more priorities",
				value: _constants.buttonValues.newPlan.noMorePriorities.value,
				type: "button"
			}, {
				name: _constants.buttonValues.newPlan.redoLastPriority.name,
				text: "Redo last priority",
				value: _constants.buttonValues.newPlan.redoLastPriority.value,
				type: "button"
			}];
			break;
		case 2:
			countString = 'third';
			actions = [{
				name: _constants.buttonValues.newPlan.noMorePriorities.name,
				text: "No more priorities",
				value: _constants.buttonValues.newPlan.noMorePriorities.value,
				type: "button"
			}, {
				name: _constants.buttonValues.newPlan.redoLastPriority.name,
				text: "Redo last priority",
				value: _constants.buttonValues.newPlan.redoLastPriority.value,
				type: "button"
			}];
			break;
		default:
			break;
	};

	var attachments = [{
		attachment_type: 'default',
		callback_id: "ADD_PRIORITY",
		fallback: "Do you want to add another priority?",
		color: _constants.colorsHash.grey.hex,
		actions: actions
	}];
	var message = 'What is the ' + countString + ' priority you want to work towards today?';

	convo.ask({
		text: message,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.redo,
		callback: function callback(response, convo) {

			if (prioritizedTasks.length > 0) {
				var task = prioritizedTasks.pop();
				convo.say('Okay! I removed `' + task.text + '` from your list');
			}
			convo.newPlan.prioritizedTasks = prioritizedTasks;
			addPriorityToList(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noMore,
		callback: function callback(response, convo) {

			includeTeamMembers(convo);
			convo.next();
		}
	}, { // this is additional task added in this case.
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};
			prioritizedTasks.push(newTask);

			var approvalWord = (0, _messageHelpers.getRandomApprovalWord)({ upperCase: true });
			var message = approvalWord + '! I added `' + newTask.text + '`';
			if (prioritizedTasks.length % 2 != 0) {
				message = message + ' to your plan';
			}
			convo.say(message);

			convo.newPlan.prioritizedTasks = prioritizedTasks;

			if (prioritizedTasks.length >= 3) {
				includeTeamMembers(convo);
			} else {
				// ask again!
				addPriorityToList(convo);
			}

			convo.next();
		}
	}]);
}

function includeTeamMembers(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan2 = convo.newPlan;
	var SlackUserId = _convo$newPlan2.SlackUserId;
	var daySplit = _convo$newPlan2.daySplit;
	var onboardVersion = _convo$newPlan2.onboardVersion;
	var includeTeamMembers = _convo$newPlan2.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTasks, options);

	convo.say('Now let’s view your plan for today :pencil::\n' + taskListMessage);

	// say who is getting included
	_models2.default.SlackUser.find({
		where: ['"SlackUserId" = ?', SlackUserId]
	}).then(function (slackUser) {

		var responseMessage = 'Excellent!';

		if (slackUser) {

			slackUser.getIncluded({
				include: [_models2.default.User]
			}).then(function (includedSlackUsers) {

				if (includedSlackUsers.length > 0) {

					// user has team members to include!!
					var names = includedSlackUsers.map(function (includedSlackUser) {
						return includedSlackUser.dataValues.User.nickName;
					});
					var nameStrings = (0, _messageHelpers.commaSeparateOutTaskArray)(names);
					responseMessage = 'I\'ll be sharing your plan with *' + nameStrings + '* when you\'re done :raised_hands:';
					convo.say(responseMessage);
					if (onboardVersion) {
						explainTimeToPriorities(convo);
					} else {
						addTimeToPriorities(convo);
					}
				} else if (includeTeamMembers) {

					// user wants to include members!!!
					askToIncludeTeamMembers(convo);
				} else {

					// user does not want to include members
					convo.say(responseMessage);
					if (onboardVersion) {
						explainTimeToPriorities(convo);
					} else {
						addTimeToPriorities(convo);
					}
					convo.next();
				}

				convo.next();
			});
		} else {

			convo.say(responseMessage);
			if (onboardVersion) {
				explainTimeToPriorities(convo);
			} else {
				addTimeToPriorities(convo);
			}
			convo.next();
		}
	});
}

// thoroughly explain why we're doing this!
function explainTimeToPriorities(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan3 = convo.newPlan;
	var SlackUserId = _convo$newPlan3.SlackUserId;
	var daySplit = _convo$newPlan3.daySplit;
	var onboardVersion = _convo$newPlan3.onboardVersion;
	var includeTeamMembers = _convo$newPlan3.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var priorityString = prioritizedTasks.length == 1 ? 'your ' + prioritizedTasks.length + ' priority' : 'each of your ' + prioritizedTasks.length + ' priorities';

	convo.say('Now let\'s put time to spend toward ' + priorityString);
	convo.say('Since this is your first time with me, let me briefly explain what\'s going on :grin:');

	var text = 'This is *how long you’d like to work on each priority for the course of the day*, from 30 minutes to 4 hours or more';
	var attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: _constants.colorsHash.green.hex,
		actions: [{
			name: _constants.buttonValues.next.name,
			text: "Why do this?",
			value: _constants.buttonValues.next.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, function (response, convo) {

		text = 'I’ll help you hold yourself accountable and *deliberately put time toward your main outcomes in chunks* that actually make sense for you and how you enter flow';
		attachments[0].actions[0].text = 'I might misestimate!';

		convo.ask({
			text: text,
			attachments: attachments
		}, function (response, convo) {

			text = 'If you finish sooner than expected, that’s fantastic! If it takes longer than expected, you can always extend time later';
			attachments[0].actions[0].text = 'What gets shared?';

			convo.ask({
				text: text,
				attachments: attachments
			}, function (response, convo) {

				text = 'I don’t communicate how long you spend working toward your outcomes to anyone else but you, so you can feel safe about your pace and time to getting the most important things done';
				convo.say(text);
				text = '*You define time well spent for yourself* and my goal is to help you follow through on it and actually build useful pictures of your day';
				attachments[0].actions[0].text = 'Sounds great!';

				convo.ask({
					text: text,
					attachments: attachments
				}, function (response, convo) {

					addTimeToPriorities(convo);
					convo.next();
				});

				convo.next();
			});

			convo.next();
		});

		convo.next();
	});
}

function askToIncludeTeamMembers(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan4 = convo.newPlan;
	var SlackUserId = _convo$newPlan4.SlackUserId;
	var daySplit = _convo$newPlan4.daySplit;
	var onboardVersion = _convo$newPlan4.onboardVersion;
	var includeTeamMembers = _convo$newPlan4.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var message = 'Would you like to share your plan with a colleague? *Just mention a Slack username* like `@emily` and I’ll share your priorities with them';

	if (onboardVersion) {
		convo.say(message);
		message = 'This makes it easy to communicate your outcomes for today, and make sure that you\'re working on the highest priority items for yourself and your team';
	};

	var attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.notToday.name,
			text: "Not today!",
			value: _constants.buttonValues.notToday.value,
			type: "button"
		}, {
			name: _constants.buttonValues.noDontAskAgain.name,
			text: "No - dont ask again",
			value: _constants.buttonValues.noDontAskAgain.value,
			type: "button"
		}, {
			name: _constants.buttonValues.newPlan.redoLastPriority.name,
			text: "Redo last priority",
			value: _constants.buttonValues.newPlan.redoLastPriority.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: message,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.notToday,
		callback: function callback(response, convo) {

			convo.say('Okay! I won\'t include anyone for today\'s plan');
			if (onboardVersion) {
				explainTimeToPriorities(convo);
			} else {
				addTimeToPriorities(convo);
			}
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noDontAskAgain,
		callback: function callback(response, convo) {

			convo.newPlan.dontIncludeAnyonePermanent = true;
			convo.say('No worries! I won’t ask again. You can add someone to receive your priorities when you make them by saying `show settings`');
			if (onboardVersion) {
				explainTimeToPriorities(convo);
			} else {
				addTimeToPriorities(convo);
			}
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.redo,
		callback: function callback(response, convo) {

			if (prioritizedTasks.length > 0) {
				var task = prioritizedTasks.pop();
				convo.say('Okay! I removed `' + task.text + '` from your list');
			}
			convo.newPlan.prioritizedTasks = prioritizedTasks;
			addPriorityToList(convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;


			var includeSlackUserIds = (0, _miscHelpers.getSlackUsersFromString)(text);

			if (includeSlackUserIds) {
				_models2.default.SlackUser.findAll({
					where: ['"SlackUser"."SlackUserId" IN (?)', includeSlackUserIds],
					include: [_models2.default.User]
				}).then(function (slackUsers) {

					var userNames = slackUsers.map(function (slackUser) {
						return slackUser.dataValues.User.nickName;
					});
					var finalSlackUserIdsToInclude = slackUsers.map(function (slackUser) {
						return slackUser.dataValues.SlackUserId;
					});

					convo.newPlan.includeSlackUserIds = finalSlackUserIdsToInclude;
					var userNameStrings = (0, _messageHelpers.commaSeparateOutTaskArray)(userNames);

					convo.say('Great! After planning, I\'ll let *' + userNameStrings + '*  know that you’ll be focused on these priorities today');
					convo.say("You can add someone to receive your priorities automatically when you make them each morning by saying `show settings`");
					if (onboardVersion) {
						explainTimeToPriorities(convo);
					} else {
						addTimeToPriorities(convo);
					}
					convo.next();
				});
			} else {

				convo.say("You didn't include any users! I pick up who you want to include by their slack handles, like `@fulton`");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}

// add time to each of your priorities
function addTimeToPriorities(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan5 = convo.newPlan;
	var tz = _convo$newPlan5.tz;
	var SlackUserId = _convo$newPlan5.SlackUserId;
	var daySplit = _convo$newPlan5.daySplit;
	var onboardVersion = _convo$newPlan5.onboardVersion;
	var includeTeamMembers = _convo$newPlan5.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var count = 0;
	var countString = '';

	prioritizedTasks.some(function (prioritizedTask) {
		if (!prioritizedTask.minutes) {
			return true;
		}
		count++;
	});

	var prioritizedTask = prioritizedTasks[count];
	if (count == 0) {
		convo.say('Let\'s start to put this together now :hammer:');
	}

	if (count >= prioritizedTasks.length) {
		// count should never be greater, but this is a safety measure

		startOnFirstTask(convo);
		convo.next();
	} else {

		var text = 'How much time do you want to put toward `' + prioritizedTask.text + '` today?';
		var attachments = [{
			attachment_type: 'default',
			callback_id: "REDO_PRIORITIES",
			fallback: "Do you want to redo priorities?",
			color: _constants.colorsHash.grey.hex,
			actions: []
		}];

		if (count == 0) {
			attachments[0].actions.push({
				name: _constants.buttonValues.redoMyPriorities.name,
				text: "Redo my priorities!",
				value: _constants.buttonValues.redoMyPriorities.value,
				type: "button"
			});
		} else {
			attachments[0].actions.push({
				name: _constants.buttonValues.goBack.name,
				text: "Wait, go back!",
				value: _constants.buttonValues.goBack.value,
				type: "button"
			});
		}

		convo.ask({
			text: text,
			attachments: attachments
		}, [{
			pattern: _botResponses.utterances.containsRedo,
			callback: function callback(response, convo) {

				convo.say("Okay! Let's redo your priorities! :repeat:");
				convo.newPlan.prioritizedTasks = [];
				convo.newPlan.onboardVersion = false;
				addPriorityToList(convo);
				convo.next();
			}
		}, {
			pattern: _botResponses.utterances.goBack,
			callback: function callback(response, convo) {

				if (count > 0) {
					convo.say("Okay! Let's go back");
					count--;
					delete prioritizedTasks[count].minutes;
					convo.newPlan.prioritizedTasks = prioritizedTasks;
					addTimeToPriorities(convo);
				} else {
					convo.say('You can\'t go back on your first task!');
					convo.repeat();
				}

				convo.next();
			}
		}, {
			default: true,
			callback: function callback(response, convo) {

				// use wit to decipher the relative time. if no time, then re-ask
				var _response$intentObjec = response.intentObject.entities;
				var duration = _response$intentObjec.duration;
				var datetime = _response$intentObjec.datetime;

				var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);

				var minutes = 0;
				var now = (0, _momentTimezone2.default)();

				if (customTimeObject) {
					if (duration) {
						minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
					} else {
						minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
					}
				}

				console.log('\n\n\nminutes to ' + prioritizedTask.text + ': ' + minutes + '\n\n\n');

				if (minutes > 0) {

					var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
					convo.say('Got it! I set ' + timeString + ' to `' + prioritizedTask.text + '` :stopwatch:');
					prioritizedTask.minutes = minutes;
					convo.newPlan.prioritizedTasks[count] = prioritizedTask;
					addTimeToPriorities(convo);
				} else {

					convo.say("Sorry, I didn't catch that. Let me know a time `i.e. 1 hour 45 minutes`");
					convo.repeat();
				}

				convo.next();
			}
		}]);
	}
}

// start on the first task, with opportunity to change priority
function startOnFirstTask(convo) {
	var bot = convo.task.bot;
	var _convo$newPlan6 = convo.newPlan;
	var tz = _convo$newPlan6.tz;
	var SlackUserId = _convo$newPlan6.SlackUserId;
	var daySplit = _convo$newPlan6.daySplit;
	var onboardVersion = _convo$newPlan6.onboardVersion;
	var includeTeamMembers = _convo$newPlan6.includeTeamMembers;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	var prioritizedTask = prioritizedTasks[0];

	var message = 'Let\'s get the day started with `' + prioritizedTask.text + '` :muscle:. When do you want to start?';

	var attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.now.name,
			text: "Now! :horse_racing:",
			value: _constants.buttonValues.now.value,
			type: "button"
		}, {
			name: _constants.buttonValues.inTenMinutes.name,
			text: "In 10 min :timer_clock:",
			value: _constants.buttonValues.inTenMinutes.value,
			type: "button"
		}]
	}];

	if (prioritizedTasks.length > 1) {
		attachments[0].actions.push({
			name: _constants.buttonValues.changePriority.name,
			text: "Do Different Priority",
			value: _constants.buttonValues.changePriority.value,
			type: "button"
		});
	}

	convo.ask({
		text: message,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.containsNow,
		callback: function callback(response, convo) {

			convo.say('You\'re crushing this ' + daySplit + ' :punch:');
			convo.newPlan.startNow = true;
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.changePriority,
		callback: function callback(response, convo) {

			chooseFirstTask(convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// use wit to decipher the relative time. if no time, then re-ask
			var _response$intentObjec2 = response.intentObject.entities;
			var duration = _response$intentObjec2.duration;
			var datetime = _response$intentObjec2.datetime;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);

			var minutes = void 0;
			var now = (0, _momentTimezone2.default)();
			if (customTimeObject) {

				convo.newPlan.startTime = customTimeObject;
				if (duration) {
					minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
				} else {
					minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				}
				var timeString = customTimeObject.format("h:mm a");
				convo.say('Okay! I\'ll see you at ' + timeString + ' to get started :timer_clock:');
				convo.next();
			} else {
				convo.say("Sorry, I didn't catch that. Let me know a time `i.e. let's start in 10 minutes`");
				convo.repeat();
			}

			convo.next();
		}
	}]);

	convo.next();
}

// this moves the chosen task as your #1 priority
function chooseFirstTask(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var bot = convo.task.bot;
	var _convo$newPlan7 = convo.newPlan;
	var daySplit = _convo$newPlan7.daySplit;
	var onboardVersion = _convo$newPlan7.onboardVersion;
	var prioritizedTasks = convo.newPlan.prioritizedTasks;


	if (question == '') // this is the default question!
		question = 'Which of your ' + prioritizedTasks.length + ' priorities do you want to work on first?';

	if (prioritizedTasks.length == 1) {
		// no need to choose if 1 task
		startOnFirstTask(convo);
	} else {

		// 2+ tasks means you can choose your #1 priority
		var options = { dontShowMinutes: true, dontCalculateMinutes: true };
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(prioritizedTasks, options);

		convo.ask({
			text: question + '\n' + taskListMessage,
			attachments: [{
				attachment_type: 'default',
				callback_id: "REDO_TASKS",
				fallback: "Do you want to work on this task?",
				color: _constants.colorsHash.grey.hex,
				actions: [{
					name: _constants.buttonValues.redoMyPriorities.name,
					text: "Redo my priorities!",
					value: _constants.buttonValues.redoMyPriorities.value,
					type: "button"
				}]
			}]
		}, [{
			pattern: _botResponses.utterances.containsRedo,
			callback: function callback(response, convo) {

				convo.say("Okay! Let's try this again :repeat:");
				convo.newPlan.prioritizedTasks = [];
				addPriorityToList(convo);
				convo.next();
			}
		}, {
			pattern: _botResponses.utterances.containsNumber,
			callback: function callback(response, convo) {

				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, prioritizedTasks);
				var taskIndexToWorkOn = taskNumbersToWorkOnArray[0] - 1;

				if (taskIndexToWorkOn >= 0) {

					if (taskNumbersToWorkOnArray.length == 1) {

						// move that one to front of array (top priority)
						prioritizedTasks.move(taskIndexToWorkOn, 0);
						convo.newPlan.prioritizedTasks = prioritizedTasks;
						convo.say('Sounds great to me!');
						startOnFirstTask(convo);
					} else {
						// only one at a time
						convo.say("Let's work on one priority at a time!");
						var _question = "Which one do you want to start with?";
						chooseFirstTask(convo, _question);
					}
				} else {
					convo.say("Sorry, I didn't catch that. Let me know a number `i.e. priority 2`");
					var _question2 = "Which of these do you want to start off with?";
					chooseFirstTask(convo, _question2);
				}

				convo.next();
			}
		}, {
			default: true,
			callback: function callback(response, convo) {
				convo.say("Sorry, I didn't catch that. Let me know a number `i.e. priority 2`");
				convo.repeat();
				convo.next();
			}
		}]);
	}
}
//# sourceMappingURL=plan.js.map