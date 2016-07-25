'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

// END OF A WORK SESSION


exports.default = function (controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		/**
   * 			check if user has open session (should only be one)
   * 					if yes, trigger finish and end_session flow
   * 			  	if no, reply with confusion & other options
   */

		var SlackUserId = message.user;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {
			if (_botResponses.utterances.containsTask.test(message.text)) {
				// want to finish off some tasks
				controller.trigger('edit_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
			} else {
				controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId }]);
			}
		}, 800);
	});

	controller.on('done_session_flow', function (bot, config) {

		// you can pass in a storedWorkSession
		var SlackUserId = config.SlackUserId;
		var storedWorkSession = config.storedWorkSession;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			user.getWorkSessions({
				where: ['"open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				include: [_models2.default.DailyTask]
			}).then(function (workSessions) {

				var UserId = user.id;
				var workSession = storedWorkSession || workSessions[0];

				// if live work session, confirm end early
				// else, user MUST say `done` to trigger end (this properly simulates user is done with that session)
				if (workSession) {

					workSession.getStoredWorkSession({
						where: ['"StoredWorkSession"."live" = ?', true]
					}).then(function (storedWorkSession) {

						var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
							return dailyTask.id;
						});

						user.getDailyTasks({
							where: ['"DailyTask"."id" IN (?) AND "Task"."done" = ?', dailyTaskIds, false],
							include: [_models2.default.Task]
						}).then(function (dailyTasks) {

							var taskTextsToWorkOnArray = dailyTasks.map(function (dailyTask) {
								var text = dailyTask.Task.dataValues.text;
								return text;
							});
							var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
								var tz = user.SlackUser.tz;
								var defaultBreakTime = user.defaultBreakTime;


								convo.doneSessionEarly = {
									SlackUserId: SlackUserId,
									dailyTaskIds: dailyTaskIds,
									workSession: workSession,
									doneEarlyDecision: false
								};

								convo.sessionEnd = {
									UserId: user.id,
									tz: tz,
									postSessionDecision: false,
									reminders: [],
									tasksCompleted: [],
									SlackUserId: SlackUserId,
									defaultBreakTime: defaultBreakTime
								};

								// get times for user
								var now = (0, _momentTimezone2.default)();
								var endTime = (0, _momentTimezone2.default)(workSession.dataValues.endTime).tz(tz);
								var endTimeString = endTime.format("h:mm a");
								var minutes = _momentTimezone2.default.duration(endTime.diff(now)).asMinutes();
								var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

								convo.doneSessionEarly.currentSession = {
									minutesString: minutesString,
									endTimeString: endTimeString,
									tasksToWorkOnString: tasksToWorkOnString
								};

								if (storedWorkSession) {
									minutes = storedWorkSession.dataValues.minutes;
									minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
									// currently paused
									convo.doneSessionEarly.currentSession.isPaused = true;
									convo.doneSessionEarly.currentSession.minutesString = minutesString;
								}

								var message = '';
								if (dailyTasks.length == 0) {
									message = 'Did you finish your tasks for this session?';
								} else {
									message = 'Did you finish ' + tasksToWorkOnString + '?';
								}

								convo.ask({
									text: message,
									attachments: [{
										attachment_type: 'default',
										callback_id: "DONE_SESSION",
										fallback: "Are you done with your session?",
										actions: [{
											name: _constants.buttonValues.doneSessionYes.name,
											text: "Yes! :punch:",
											value: _constants.buttonValues.doneSessionYes.value,
											type: "button",
											style: "primary"
										}, {
											name: _constants.buttonValues.doneSessionDidSomethingElse.name,
											text: "Did something else",
											value: _constants.buttonValues.doneSessionDidSomethingElse.value,
											type: "button"
										}, {
											name: _constants.buttonValues.cancelSession.name,
											text: "Nope",
											value: _constants.buttonValues.cancelSession.value,
											type: "button"
										}, {
											name: _constants.buttonValues.doneSessionEarlyNo.name,
											text: "Continue session",
											value: _constants.buttonValues.doneSessionEarlyNo.value,
											type: "button"
										}]
									}]
								}, [{
									pattern: _constants.buttonValues.doneSessionYes.value,
									callback: function callback(response, convo) {
										convo.doneSessionEarly.doneEarlyDecision = _constants.sessionTimerDecisions.didTask;
										askUserPostSessionOptions(response, convo);
										convo.next();
									}
								}, { // same as buttonValues.doneSessionYes.value
									pattern: _botResponses.utterances.yes,
									callback: function callback(response, convo) {

										// delete button when answered with NL
										(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

										convo.say("Great work :raised_hands:");
										convo.doneSessionEarly.doneEarlyDecision = _constants.sessionTimerDecisions.didTask;
										askUserPostSessionOptions(response, convo);
										convo.next();
									}
								}, { // this just triggers `end_session` flow
									pattern: _constants.buttonValues.doneSessionDidSomethingElse.value,
									callback: function callback(response, convo) {
										convo.doneSessionEarly.doneEarlyDecision = _constants.sessionTimerDecisions.didSomethingElse;
										convo.next();
									}
								}, { // same as buttonValues.doneSessionDidSomethingElse.value
									pattern: _botResponses.utterances.containsElse,
									callback: function callback(response, convo) {

										// delete button when answered with NL
										(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

										convo.doneSessionEarly.doneEarlyDecision = _constants.sessionTimerDecisions.didSomethingElse;
										convo.say(':ocean: Woo!');
										convo.next();
									}
								}, { // continue session
									pattern: _constants.buttonValues.doneSessionEarlyNo.value,
									callback: function callback(response, convo) {
										var currentSession = convo.doneSessionEarly.currentSession;
										var minutesString = currentSession.minutesString;
										var tasksToWorkOnString = currentSession.tasksToWorkOnString;
										var endTimeString = currentSession.endTimeString;


										if (currentSession.isPaused) {
											// paused session
											convo.say({
												text: 'Let me know when you want to resume your session for ' + tasksToWorkOnString,
												attachments: _constants.pausedSessionOptionsAttachments
											});
										} else {
											// live session
											convo.say({
												text: 'Good luck with ' + tasksToWorkOnString + '! See you at *' + endTimeString + '* :timer_clock:',
												attachments: _constants.startSessionOptionsAttachments
											});
										}
										convo.next();
									}
								}, { // same as buttonValues.doneSessionNo.value
									pattern: _botResponses.utterances.containsContinue,
									callback: function callback(response, convo) {

										// delete button when answered with NL
										(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

										convo.say('Got it');
										convo.say('I\'ll see you in ' + minutesString + ' at *' + endTimeString + '*! Keep crushing :muscle:');
										convo.next();
									}
								}, {
									pattern: _constants.buttonValues.cancelSession.value,
									callback: function callback(response, convo) {
										convo.doneSessionEarly.doneEarlyDecision = _constants.sessionTimerDecisions.cancelSession;
										askUserPostSessionOptions(response, convo);
										convo.next();
									}
								}, { // same as buttonValues.cancelSession.value
									pattern: _botResponses.utterances.no,
									callback: function callback(response, convo) {

										// delete button when answered with NL
										(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

										convo.doneSessionEarly.doneEarlyDecision = _constants.sessionTimerDecisions.cancelSession;
										convo.say("No worries! We'll get that done soon");
										askUserPostSessionOptions(response, convo);
										convo.next();
									}
								}, { // this is failure point. restart with question
									default: true,
									callback: function callback(response, convo) {
										convo.say("I didn't quite get that :thinking_face:");
										convo.repeat();
										convo.next();
									}
								}]);
								convo.next();

								/**
         * 		~~ END OF THIS CONVO ~~
         */

								convo.on('end', function (convo) {
									var _convo$doneSessionEar = convo.doneSessionEarly;
									var SlackUserId = _convo$doneSessionEar.SlackUserId;
									var dailyTaskIds = _convo$doneSessionEar.dailyTaskIds;
									var doneEarlyDecision = _convo$doneSessionEar.doneEarlyDecision;
									var _convo$sessionEnd = convo.sessionEnd;
									var postSessionDecision = _convo$sessionEnd.postSessionDecision;
									var reminders = _convo$sessionEnd.reminders;


									if (doneEarlyDecision) {

										(0, _miscHelpers.closeOldRemindersAndSessions)(user);

										switch (doneEarlyDecision) {
											case _constants.sessionTimerDecisions.didTask:
												// update the specific task finished
												user.getDailyTasks({
													where: ['"DailyTask"."id" IN (?)', dailyTaskIds],
													include: [_models2.default.Task]
												}).then(function (dailyTasks) {
													var completedTaskIds = dailyTasks.map(function (dailyTask) {
														return dailyTask.TaskId;
													});
													_models2.default.Task.update({
														done: true
													}, {
														where: ['"Tasks"."id" in (?)', completedTaskIds]
													});
												});
												break;
											case _constants.sessionTimerDecisions.didSomethingElse:
												controller.trigger('end_session', [bot, { SlackUserId: SlackUserId }]);
												return;
											case _constants.sessionTimerDecisions.cancelSession:
												break;
											case _constants.sessionTimerDecisions.newSession:
												controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
												return;
											default:
												break;
										}

										/**
           * 		~~ THIS IS SIMULATION OF `session_end` FLOW
           * 		essentially figuring out postSessionDecision
           */

										// then from here, active the postSessionDecisions
										setTimeout(function () {
											handlePostSessionDecision(postSessionDecision, { controller: controller, bot: bot, SlackUserId: SlackUserId });
										}, 500);

										// set reminders (usually a break)
										reminders.forEach(function (reminder) {
											var remindTime = reminder.remindTime;
											var customNote = reminder.customNote;
											var type = reminder.type;

											_models2.default.Reminder.create({
												UserId: UserId,
												remindTime: remindTime,
												customNote: customNote,
												type: type
											});
										});
									} else {
										(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
									}
								});
							});
						});
					});
				} else {

					// want to be end a session when they arent currently in one
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.ask('You aren\'t in a session right now! Would you like to start one?', [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								convo.startSession = true;
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								convo.say('Okay! I\'ll be here when you\'re ready to crank again :wrench: ');
								convo.next();
							}
						}, {
							default: true,
							callback: function callback(response, convo) {
								convo.say("Sorry, I didn't get that. Please tell me `yes` or `no` to the question!");
								convo.repeat();
								convo.next();
							}
						}]);
						convo.next();
						convo.on('end', function (convo) {
							if (convo.startSession) {
								controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
							} else {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							}
						});
					});
				}
			});
		});
	});

	/**
  * 			~~ START OF SESSION_TIMER FUNCTIONALITIES ~~
  */

	// session timer is up AND IN CONVO.ASK FLOW!
	controller.on('session_timer_up', function (bot, config) {

		/**
   * 		Timer is up. Give user option to extend session or start reflection
   */

		var SlackUserId = config.SlackUserId;
		var workSession = config.workSession;

		var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
			return dailyTask.id;
		});

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var defaultSnoozeTime = user.defaultSnoozeTime;
			var defaultBreakTime = user.defaultBreakTime;


			user.getDailyTasks({
				where: ['"DailyTask"."id" IN (?) AND "Task"."done" = ?', dailyTaskIds, false],
				include: [_models2.default.Task]
			}).then(function (dailyTasks) {

				// cancel all old reminders
				user.getReminders({
					where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break", "done_session_snooze"]]
				}).then(function (oldReminders) {
					oldReminders.forEach(function (reminder) {
						reminder.update({
							"open": false
						});
					});
				});

				var taskTextsToWorkOnArray = dailyTasks.map(function (dailyTask) {
					var text = dailyTask.Task.dataValues.text;
					return text;
				});
				var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

				// making this just a reminder now so that user can end his own session as he pleases
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					var source_message = convo.source_message;


					convo.doneSessionTimerObject = {
						SlackUserId: SlackUserId,
						sessionTimerDecision: false,
						dailyTaskIds: dailyTaskIds
					};

					var tz = user.SlackUser.tz;


					convo.sessionEnd = {
						UserId: user.id,
						tz: tz,
						postSessionDecision: false,
						reminders: [],
						tasksCompleted: [],
						SlackUserId: SlackUserId,
						defaultBreakTime: defaultBreakTime,
						defaultSnoozeTime: defaultSnoozeTime
					};

					if (source_message) {
						convo.doneSessionTimerObject.channel = source_message.channel;
						convo.sessionEnd.channel = source_message.channel;
					}

					var timeOutMinutes = 1000 * 60 * _constants.MINUTES_FOR_DONE_SESSION_TIMEOUT;

					setTimeout(function () {
						convo.doneSessionTimerObject.timeOut = true;
						convo.stop();
					}, timeOutMinutes);

					var message = '';
					if (dailyTasks.length == 0) {
						message = 'Hey, did you finish your tasks for this session?';
					} else {
						message = 'Hey, did you finish ' + tasksToWorkOnString + '?';
					}

					var extendSessionText = defaultSnoozeTime ? 'Extend by ' + defaultSnoozeTime + ' min' : 'Extend Session';
					extendSessionText = extendSessionText + ' :timer_clock:';

					convo.ask({
						text: message,
						attachments: [{
							attachment_type: 'default',
							callback_id: "DONE_SESSION",
							fallback: "Did you finish your session?",
							actions: [{
								name: _constants.buttonValues.doneSessionYes.name,
								text: "Yes! :punch:",
								value: _constants.buttonValues.doneSessionYes.value,
								type: "button",
								style: "primary"
							}, {
								name: _constants.buttonValues.doneSessionSnooze.name,
								text: extendSessionText,
								value: _constants.buttonValues.doneSessionSnooze.value,
								type: "button"
							}, {
								name: _constants.buttonValues.doneSessionDidSomethingElse.name,
								text: "Did something else",
								value: _constants.buttonValues.doneSessionDidSomethingElse.value,
								type: "button"
							}, {
								name: _constants.buttonValues.doneSessionNo.name,
								text: "Nope",
								value: _constants.buttonValues.doneSessionNo.value,
								type: "button"
							}]
						}]
					}, [{
						pattern: _constants.buttonValues.doneSessionYes.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didTask;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // same as buttonValues.doneSessionYes.value
						pattern: _botResponses.utterances.yes,
						callback: function callback(response, convo) {

							// delete button when answered with NL
							(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

							convo.say("Great work :raised_hands:");
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didTask;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, {
						pattern: _constants.buttonValues.doneSessionSnooze.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.snooze;
							convo.next();
						}
					}, { // same as buttonValues.doneSessionSnooze.value
						pattern: _botResponses.utterances.containsSnooze,
						callback: function callback(response, convo) {

							// delete button when answered with NL
							(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

							convo.say('Keep at it!');
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.snooze;

							// wit will pick up duration here
							var text = response.text;
							var duration = response.intentObject.entities.duration;

							convo.doneSessionTimerObject.customSnooze = {
								text: text,
								duration: duration
							};

							convo.next();
						}
					}, { // this just triggers `end_session` flow
						pattern: _constants.buttonValues.doneSessionDidSomethingElse.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didSomethingElse;
							convo.next();
						}
					}, { // same as buttonValues.doneSessionDidSomethingElse.value
						pattern: _botResponses.utterances.containsElse,
						callback: function callback(response, convo) {

							// delete button when answered with NL
							(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.didSomethingElse;
							convo.say(':ocean: Woo!');
							convo.next();
						}
					}, {
						pattern: _constants.buttonValues.doneSessionNo.value,
						callback: function callback(response, convo) {
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.noTasks;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // same as buttonValues.doneSessionNo.value
						pattern: _botResponses.utterances.no,
						callback: function callback(response, convo) {

							// delete button when answered with NL
							(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

							convo.say('That\'s okay! You can keep chipping away and you\'ll get there :pick:');
							convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.noTasks;
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // this is failure point. restart with question
						default: true,
						callback: function callback(response, convo) {

							// wit will pick up duration here
							var text = response.text;
							var duration = response.intentObject.entities.duration;

							if (duration) {
								// allow extend if they just put time
								convo.doneSessionTimerObject.customSnooze = {
									text: text,
									duration: duration
								};
								// delete button when answered with NL
								(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

								convo.say('Keep at it!');
								convo.doneSessionTimerObject.sessionTimerDecision = _constants.sessionTimerDecisions.snooze;
							} else {
								// otherwise we're confused
								convo.say("I didn't quite get that :thinking_face:");
								convo.repeat();
							}

							convo.next();
						}
					}]);
					convo.next();

					convo.on('end', function (convo) {
						var _convo$sessionEnd2 = convo.sessionEnd;
						var postSessionDecision = _convo$sessionEnd2.postSessionDecision;
						var reminders = _convo$sessionEnd2.reminders;
						var _convo$doneSessionTim = convo.doneSessionTimerObject;
						var dailyTaskIds = _convo$doneSessionTim.dailyTaskIds;
						var timeOut = _convo$doneSessionTim.timeOut;
						var SlackUserId = _convo$doneSessionTim.SlackUserId;
						var sessionTimerDecision = _convo$doneSessionTim.sessionTimerDecision;
						var customSnooze = _convo$doneSessionTim.customSnooze;
						var channel = _convo$doneSessionTim.channel;


						_models2.default.User.find({
							where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
							include: [_models2.default.SlackUser]
						}).then(function (user) {

							if (timeOut) {

								// this "timeout" message only gets sent if this specific convo still has an open work session and no snooze attached. this means that user has gone AFK. if there is a snooze, another `done_session_timer` will trigger in 9 minutes and will be handle the ending of the work session

								// open sessions that were ENDED < 29.5 minutes ago
								var minutes = _constants.MINUTES_FOR_DONE_SESSION_TIMEOUT - 0.5;
								var timeOutMinutesAgo = (0, _momentTimezone2.default)().subtract(minutes, 'minutes').format("YYYY-MM-DD HH:mm:ss Z");
								user.getWorkSessions({
									where: ['"WorkSession"."open" = ? AND "WorkSession"."endTime" < ?', true, timeOutMinutesAgo],
									order: '"WorkSession"."createdAt" DESC'
								}).then(function (workSessions) {
									// only if there are still "open" work sessions
									// this means the user has not closed it in 30 minutes
									if (workSessions.length > 0) {

										(0, _messageHelpers.deleteMostRecentDoneSessionMessage)(channel, bot);

										// this was a 30 minute timeout for done_session timer!
										controller.trigger('done_session_timeout_flow', [bot, { SlackUserId: SlackUserId, workSession: workSession }]);
									};
								});
							} else {
								var _ret = function () {

									convo.doneSessionTimerObject.timeOut = false;

									// NORMAL FLOW
									var UserId = user.id;

									switch (sessionTimerDecision) {
										case _constants.sessionTimerDecisions.didTask:
											// update the specific task finished
											user.getDailyTasks({
												where: ['"DailyTask"."id" IN (?)', dailyTaskIds],
												include: [_models2.default.Task]
											}).then(function (dailyTasks) {
												var completedTaskIds = dailyTasks.map(function (dailyTask) {
													return dailyTask.TaskId;
												});
												_models2.default.Task.update({
													done: true
												}, {
													where: ['"Tasks"."id" in (?)', completedTaskIds]
												});
											});
											break;
										case _constants.sessionTimerDecisions.snooze:

											if (customSnooze) {
												var text = customSnooze.text;
												var duration = customSnooze.duration;

												// user only said `snooze` or `extend`

												if (_botResponses.utterances.onlyContainsSnooze.test(text) || _botResponses.utterances.onlyContainsExtend.test(text)) {
													// automatically do default snooze here then
													controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId }]);
												} else {
													// user said `snooze for X minutes`
													controller.trigger('snooze_reminder_flow', [bot, { SlackUserId: SlackUserId, duration: duration }]);
												}
											} else {
												// button triggered it (do default)
												controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId }]);
											}

											return {
												v: void 0
											};
										case _constants.sessionTimerDecisions.didSomethingElse:
											controller.trigger('end_session', [bot, { SlackUserId: SlackUserId }]);
											return {
												v: void 0
											};
										case _constants.sessionTimerDecisions.noTasks:
											// nothing
											break;
										default:
											break;
									}

									/**
          * 		~~ THIS IS SIMULATION OF `session_end` FLOW
          * 		essentially figuring out postSessionDecision
          */

									// end all OPEN work sessions here, because user
									// ~~ CLOSING a work session MUST ALSO MAKE IT NOT LIVE!! ~~
									// has decided to PROACTIVELY CLOSE IT
									user.getWorkSessions({
										where: ['"WorkSession"."open" = ?', true],
										order: '"createdAt" DESC'
									}).then(function (workSessions) {
										workSessions.forEach(function (workSession) {
											workSession.update({
												open: false,
												live: false
											});
										});

										// then from here, active the postSessionDecisions
										setTimeout(function () {
											handlePostSessionDecision(postSessionDecision, { controller: controller, bot: bot, SlackUserId: SlackUserId });
										}, 500);
									});

									// set reminders (usually a break)
									reminders.forEach(function (reminder) {
										var remindTime = reminder.remindTime;
										var customNote = reminder.customNote;
										var type = reminder.type;

										_models2.default.Reminder.create({
											UserId: UserId,
											remindTime: remindTime,
											customNote: customNote,
											type: type
										});
									});
								}();

								if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
							};
						});
					});
				});
			});
		});
	});

	/**
  * 			~~ START OF END_SESSION FLOW FUNCTIONALITIES ~~
  */

	// the actual end_session flow
	controller.on('end_session', function (bot, config) {

		/**
   * 		User has agreed for session to end at this point
   */

		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;
		var defaultBreakTime = config.defaultBreakTime;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			// object that contains values important to this conversation
			convo.sessionEnd = {
				SlackUserId: SlackUserId,
				postSessionDecision: false, // what is the user's decision? (break, another session, etc.)
				reminders: [], // there will be lots of potential reminders
				tasksCompleted: [],
				defaultBreakTime: defaultBreakTime
			};

			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				// need user's timezone for this flow!
				var tz = user.SlackUser.tz;

				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				}

				convo.sessionEnd.UserId = user.id;
				convo.sessionEnd.tz = tz;

				// this will close all sessions < now (as it should)!
				(0, _miscHelpers.closeOldRemindersAndSessions)(user);

				return user.getDailyTasks({
					where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
					order: '"DailyTask"."priority" ASC',
					include: [_models2.default.Task]
				});
			}).then(function (dailyTasks) {

				var taskArray = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
				convo.sessionEnd.taskArray = taskArray;
				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray);

				if (taskArray.length == 0) {
					convo.say("You don't have any tasks on today's list! Great work :punch:");
					convo.sessionEnd.hasNoTasksToWorkOn = true;
					askUserPostSessionOptions(err, convo);
					convo.next();
				} else {
					convo.say("Which task(s) did you get done? `i.e. tasks 1, 2`");
					convo.ask({
						text: '' + taskListMessage,
						attachments: [{
							attachment_type: 'default',
							callback_id: "FINISH_TASKS_ON_END_SESSION",
							fallback: "I was unable to process your decision",
							color: _constants.colorsHash.grey.hex,
							actions: [{
								name: _constants.buttonValues.differentTask.name,
								text: "Something Else",
								value: _constants.buttonValues.differentTask.value,
								type: "button"
							}, {
								name: _constants.buttonValues.noTasks.name,
								text: "None yet!",
								value: _constants.buttonValues.noTasks.value,
								type: "button"
							}]
						}]
					}, [{
						pattern: _constants.buttonValues.noTasks.value,
						callback: function callback(response, convo) {
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, { // same as clicking buttonValues.noTasks.value
						pattern: _botResponses.utterances.containsNone,
						callback: function callback(response, convo) {

							// delete button when answered with NL
							(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

							convo.say("No worries! :smile_cat:");
							askUserPostSessionOptions(response, convo);
							convo.next();
						}
					}, {
						pattern: _constants.buttonValues.differentTask.value,
						callback: function callback(response, convo) {
							askForDifferentCompletedTask(response, convo);
							convo.next();
						}
					}, { // same as clicking buttonValues.differentTask.value
						pattern: _botResponses.utterances.containsDifferent,
						callback: function callback(response, convo) {

							// delete button when answered with NL
							(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

							convo.say("What did you get done instead?");
							askForDifferentCompletedTask(response, convo);
							convo.next();
						}
					}, { // user has listed task numbers here
						default: true,
						callback: function callback(response, convo) {

							// user inputed task #'s (`2,4,1`), not new task button
							var entities = response.intentObject.entities;

							var tasksCompletedString = response.text;

							var taskNumberCompletedArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksCompletedString, taskArray);

							// repeat convo if invalid w/ informative context
							if (taskNumberCompletedArray) {

								// get the actual ids
								var tasksCompletedArray = [];
								taskNumberCompletedArray.forEach(function (taskNumber) {
									var index = taskNumber - 1; // to make 0-index based
									if (taskArray[index]) tasksCompletedArray.push(taskArray[index].dataValues.id);
								});

								convo.sessionEnd.tasksCompleted = tasksCompletedArray;
								convo.say("Great work :punch:");
								askUserPostSessionOptions(response, convo);
							} else {

								convo.say("Oops, I don't totally understand :dog:. Let's try this again");
								convo.say("You can pick a task from your list `i.e. tasks 1, 3` or say `none`");
								convo.repeat();
							}
							convo.next();
						}
					}]);
				}
			});

			convo.on('end', function (convo) {
				console.log("SESSION END!!!");

				var responses = convo.extractResponses();
				var sessionEnd = convo.sessionEnd;


				if (convo.status == 'completed') {
					(function () {

						console.log("CONVO SESSION END: ");
						console.log(convo.sessionEnd);

						// went according to plan
						var _convo$sessionEnd3 = convo.sessionEnd;
						var SlackUserId = _convo$sessionEnd3.SlackUserId;
						var UserId = _convo$sessionEnd3.UserId;
						var postSessionDecision = _convo$sessionEnd3.postSessionDecision;
						var reminders = _convo$sessionEnd3.reminders;
						var tasksCompleted = _convo$sessionEnd3.tasksCompleted;
						var taskArray = _convo$sessionEnd3.taskArray;
						var differentCompletedTask = _convo$sessionEnd3.differentCompletedTask;
						var tz = _convo$sessionEnd3.tz;

						// end all live sessions and reminder checkins (type `work_session`) the user might have

						_models2.default.User.find({
							where: ['"User"."id" = ?', UserId],
							include: [_models2.default.SlackUser]
						}).then(function (user) {

							/**
        * 		~~ END OF WORK SESSION ~~
        * 			1. cancel all `break` and `checkin` reminders
        * 			2. mark said `tasks` as done
        * 			3. handle postSession decision (set `break` reminder, start new session, etc.)
        * 			4. close all live worksessions
        * 			5. if completed diff task, store that for user
        */

							// cancel all checkin reminders (type: `work_session` or `break`)

							// set reminders (usually a break)
							reminders.forEach(function (reminder) {
								var remindTime = reminder.remindTime;
								var customNote = reminder.customNote;
								var type = reminder.type;

								_models2.default.Reminder.create({
									UserId: UserId,
									remindTime: remindTime,
									customNote: customNote,
									type: type
								});
							});

							// mark appropriate tasks as done
							tasksCompleted.forEach(function (TaskId) {
								_models2.default.DailyTask.find({
									where: { id: TaskId },
									include: [_models2.default.Task]
								}).then(function (dailyTask) {
									if (dailyTask) {
										dailyTask.Task.updateAttributes({
											done: true
										});
									}
								});
							});

							// get the most recent work session
							// to handle if user got new task done
							user.getWorkSessions({
								limit: 1,
								order: '"createdAt" DESC'
							}).then(function (workSessions) {

								var endTime = (0, _momentTimezone2.default)();
								// IF you chose a new task not on your list to have completed
								if (differentCompletedTask) {

									var minutes; // calculate time worked on that task
									if (workSessions.length > 0) {

										// use this to get how long the
										// custom added task took
										var startSession = workSessions[0];
										var startTime = (0, _momentTimezone2.default)(startSession.startTime);
										minutes = _momentTimezone2.default.duration(endTime.diff(startTime)).asMinutes();
									} else {
										// this should never happen.
										minutes = 30; // but if it does... default minutes duration
									}

									// create new task that the user just got done
									user.getDailyTasks({
										where: ['"DailyTask"."type" = ?', "live"]
									}).then(function (dailyTasks) {
										var priority = dailyTasks.length + 1;
										var text = differentCompletedTask;
										// record the different completed task
										_models2.default.Task.create({
											text: text,
											done: true
										}).then(function (task) {
											var TaskId = task.id;
											_models2.default.DailyTask.create({
												TaskId: TaskId,
												priority: priority,
												minutes: minutes,
												UserId: UserId
											});
										});
									});
								}

								setTimeout(function () {
									handlePostSessionDecision(postSessionDecision, { controller: controller, bot: bot, SlackUserId: SlackUserId });
								}, 500);
							});
						});
					})();
				} else {
					// FIX POTENTIAL PITFALLS HERE
					if (!sessionEnd.postSessionDecision) {
						convo.say("I'm not sure went wrong here :dog: Please let my owners know");
					}
				}
			});
		});
	});
};

exports.askUserPostSessionOptions = askUserPostSessionOptions;
exports.handlePostSessionDecision = handlePostSessionDecision;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _botResponses = require('../../lib/botResponses');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ask user for options after finishing session
function askUserPostSessionOptions(response, convo) {
	var task = convo.task;

	var defaultBreakTime = false;
	if (convo.sessionEnd) {
		defaultBreakTime = convo.sessionEnd.defaultBreakTime;
	}

	var breakText = defaultBreakTime ? 'Break for ' + defaultBreakTime + ' min' : 'Take a break';
	var bot = task.bot;
	var source_message = task.source_message;

	// only if first time!
	// convo.say("I recommend taking a 15 minute break after about 90 minutes of focused work to keep your mind and attention fresh :tangerine:");
	// convo.say("Breaks are great times to read books and articles, or take a walk outside to get some fresh air :books: :walking:");

	convo.ask({
		text: 'Would you like to take a break now, or start a new session?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "END_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.takeBreak.name,
				text: breakText,
				value: _constants.buttonValues.takeBreak.value,
				type: "button"
			}, {
				name: _constants.buttonValues.startSession.name,
				text: "Another session :muscle:",
				value: _constants.buttonValues.startSession.value,
				type: "button"
			}, {
				name: _constants.buttonValues.backLater.name,
				text: "Be Back Later",
				value: _constants.buttonValues.backLater.value,
				type: "button"
			}, {
				name: _constants.buttonValues.endDay.name,
				text: "End my day :sleeping:",
				value: _constants.buttonValues.endDay.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.takeBreak.value,
		callback: function callback(response, convo) {

			getBreakTime(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.takeBreak.value
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Let\'s take a break!');
			getBreakTime(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.startSession.value,
		callback: function callback(response, convo) {
			convo.sessionEnd.postSessionDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startSession.value
		pattern: _botResponses.utterances.startSession,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.sessionEnd.postSessionDecision = _intents2.default.START_SESSION;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.endDay.value,
		callback: function callback(response, convo) {
			convo.sessionEnd.postSessionDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, { // NL equivalent to buttonValues.endDay.value
		pattern: _botResponses.utterances.containsEnd,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.sessionEnd.postSessionDecision = _intents2.default.END_DAY;
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.backLater.value,
		callback: function callback(response, convo) {
			handleBeBackLater(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.backLater.value
		pattern: _botResponses.utterances.containsBackLater,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay! I'll be here when you get back");
			handleBeBackLater(response, convo);
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :dog:. Let's choose an option from the buttons for now");
			convo.repeat();
			convo.next();
		}
	}]);
}

// user has completed a different task and we'll take note
function askForDifferentCompletedTask(response, convo) {
	convo.ask("I'll add it as a completed task for you :memo:", function (response, convo) {
		convo.sessionEnd.differentCompletedTask = response.text;
		convo.say("Noted!");
		askUserPostSessionOptions(response, convo);
		convo.next();
	});
}

// simple way to handle be back later
function handleBeBackLater(response, convo) {
	convo.say("You can also ask for me to check in with you at a specific time later :grin:");
}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getBreakTime(response, convo) {
	var text = response.text;
	var _response$intentObjec = response.intentObject.entities;
	var duration = _response$intentObjec.duration;
	var datetime = _response$intentObjec.datetime;
	var _convo$sessionEnd4 = convo.sessionEnd;
	var tz = _convo$sessionEnd4.tz;
	var defaultBreakTime = _convo$sessionEnd4.defaultBreakTime;
	var UserId = _convo$sessionEnd4.UserId;

	var now = (0, _momentTimezone2.default)();

	convo.sessionEnd.postSessionDecision = _intents2.default.WANT_BREAK; // user wants a break!

	var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultBreakTime && UserId) {
			convo.say('This is your first time hitting break! The default break time is *' + _constants.TOKI_DEFAULT_BREAK_TIME + ' minutes*, but you can change it in your settings by telling me to `show settings`');
			convo.say("You can also specify a custom break time by saying `break for 20 minutes` or something like that :grinning:");
			// first time not updating at convo end...
			_models2.default.User.update({
				defaultBreakTime: 10
			}, {
				where: ['"Users"."id" = ?', UserId]
			});
		}
		customTimeObject = (0, _momentTimezone2.default)().add(_constants.TOKI_DEFAULT_BREAK_TIME, 'minutes');
	}
	var customTimeString = customTimeObject.format("h:mm a");
	var durationMinutes = parseInt(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

	if (!defaultBreakTime && UserId) {
		convo.say('I set your default break time to ' + _constants.TOKI_DEFAULT_BREAK_TIME + ' minutes and will check with you then. See you at *' + customTimeString + '*!');
	} else {
		convo.say('I\'ll check in with you in ' + durationMinutes + ' minutes at *' + customTimeString + '* :smile:');
	}

	convo.sessionEnd.reminders.push({
		customNote: 'It\'s been ' + durationMinutes + ' minutes. Let me know when you\'re ready to start a session',
		remindTime: customTimeObject,
		type: "break"
	});

	convo.sessionEnd.breakDuration = durationMinutes;
	convo.next();
}

// NEED ALL 3 FOR CONFIG: SlackUserId, controller, bot
function handlePostSessionDecision(postSessionDecision, config) {
	var SlackUserId = config.SlackUserId;
	var controller = config.controller;
	var bot = config.bot;


	switch (postSessionDecision) {
		case _intents2.default.WANT_BREAK:
			break;
		case _intents2.default.END_DAY:
			controller.trigger('trigger_day_end', [bot, { SlackUserId: SlackUserId }]);
			return;
		case _intents2.default.START_SESSION:
			controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
			return;
		default:
			break;
	}

	// this is the end of the conversation, which is when we will
	// resume all previously canceled sessions
	(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
}
//# sourceMappingURL=endWorkSession.js.map