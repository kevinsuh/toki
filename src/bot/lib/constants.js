import moment from 'moment-timezone';

export const utterances = {

	yes: new RegExp(/((^y|yes|yea|yup|yep|ya|sure|ok|okay|yeah|yah|ye)\b|(\bd[o ]+[this]{2,})|(\bd[o ]+[it]+)|\by[esahp]{2,}\b|\bs[ure]{2,}\b|\bs[tart]{2,}\b)/i),
	yesOrCorrect: new RegExp(/((^y|yes|yea|yup|yep|ya|sure|ok|okay|yeah|yah|ye)\b|\by[esahp]{2,}\b|\bs[ure]{2,}\b|\bc[correct]{4,})/i),
	no: new RegExp(/((no|not|nah|nope|^n)\b|\bn[oahpe]{1,4}\b)/i),
	noAndNeverMind: new RegExp(/^n([oahpet]{1,5}|e[ever mind]{4,}|[vm]{1,4})[.?!~]*$|^goo[od ]{1,5}\bfo[or ]{1,5}\bnow[.?!~]*$/i),
	onlyNeverMind: new RegExp(/^ne[ever mind]{4,}$/i),
	containsNoOrNeverMindOrNothing: new RegExp(/\bn(oth[othing]{2,5}|[oahpet]{1,5}|e[ever mind]{4,}|[vm]{1,4})\b|\bgoo[od ]{1,5}\bfo[or ]{1,5}\bnow\b/i),
	startsWithNever: new RegExp(/^ne[never]{3,}\b/i),
	specificYes: new RegExp(/((yes|yea|yup|yep|ya|sure|ok|yeah|yah|ye)|\by[esahp]{2,}\b|\bs[ure]{2,}\b)/i),
	endDay: new RegExp(/\be[end ]{2,}\b.*\bd[day]{2,}/i),
	notDone: new RegExp(/\bn[not]{2,}\b.*\bdo[one]{2,}/i),
	containsNew: new RegExp(/(\bn[new]{2,4}\b)/i),
	containsCheckin: new RegExp(/(\bch[check in]{3,}\b|\br[reminder]{4,}\b|\bn[note]{2,}\b)/i),
	containsOnlyCheckin: new RegExp(/(\bch[check -in]{4,}\b)/i),
	containsChangeTime: new RegExp(/(ch[change ]{3,}t[time ]{2,})/i),
	containsAddNote: new RegExp(/(a[add ]{1,}n[note ]{2,})/i),
	containsBreak: new RegExp(/(\bbr[reak ]{2,}\b)/i),
	containsBackLater: new RegExp(/(b[back ]{2,}l[later ]{2,})/i),
	startSession:  new RegExp(/((s[start ]{2,}|n[new ]{2,}|w[work ]{2,})|s[session]{2,})/i),
	containsEnd: new RegExp(/(e[end]{2,})/i),
	containsNone: new RegExp(/((no|none|didnt|didn't)|\bn[otahpe]+\b)/i),
	containsDifferent: new RegExp(/((\bdi[different]{4,}\b)|(\b[else ]{3,}\b))/i),
	containsNumber: new RegExp(/\d/i),
	containsAll: new RegExp(/\ba[all]{2,}/i),
	containsAdd: new RegExp(/\ba[add]{1,}/i),
	containsNow: new RegExp(/\bnow[ow]{0,3}\b/i),
	containsRedo: new RegExp(/\bre[re do]{2,5}\b/i),
	startsWithAdd: new RegExp(/^a[add]{2,}\b/i),
	containsTask: new RegExp(/t[task]{2,}/i),
	containsTaskOrPriority: new RegExp(/\b(t[task]{2,}|pr[riority]{4,})\b/i),
	containsName: new RegExp(/\bna[name]{2,5}\b/i),
	containsTimeZone: new RegExp(/\btime[timezone ]{3,6}\b/i),
	containsPlan: new RegExp(/\bpl[lan]{2,}\b/i),
	containsPriority: new RegExp(/\bprior[ity]{2,6}\b/i),
	containsPing: new RegExp(/\bpin[ng]{1,4}\b/i),
	containsAdditional: new RegExp(/\ba[additional]{4,}/i),
	containsSnooze: new RegExp(/(\bs[snooze]{4,}|\be[extend]{4,})/i),
	onlyContainsSnooze: new RegExp(/^s[snooze]{4,}$/i),
	onlyContainsExtend: new RegExp(/^e[extend]{4,}$/i),
	containsExtend: new RegExp(/\bext[extend]{3,}\b/i),
	containsElse: new RegExp(/\be[else]{2,}/i),
	containsShowCommands: new RegExp(/(\bs[show]{2,}|\bc[commands]{4,})/i),
	containsStartDay: new RegExp(/(\bs[start]{3,}|\bd[day]{2,})/i),
	containsSettings: new RegExp(/\bs[settings]{4,}/i),
	containsEditTaskList: new RegExp(/(\be[edit ]{2,}\b(l[list]{2,}|t[task]{2,}|p[plan]{2,})\b)/i),
	containsCompleteOrCheckOrCross: new RegExp(/(\bcom[omplete]{4,}|\bch[heck]{2,}|\bcr[ross]{3,})/i),
	containsDeleteOrRemove: new RegExp(/(\bd[delete]{4,}|\br[remove]{3,})/i),
	containsTime: new RegExp(/(\bt[time]{2,})/i),
	containsCancel: new RegExp(/(\bc[cancel]{4,})/i),
	containsContinue: new RegExp(/(\bc[continue]{5,})/i),
	done: new RegExp(/(^d[done]{2,}$)/i),
	noAdditional: new RegExp(/(\bn[no ]{1,}\ba[additional]{5,}\b|^no\b|^no[one]{2,4}$)/i),
	containsKeep: new RegExp(/(\bke[ep]{2,6}\b)/i),
	containsChange: new RegExp(/(\bchan[nge]{1,4}\b)/i),
	containsDisable: new RegExp(/(\bdisab[ble]{1,4}\b)/i),
	containsShare: new RegExp(/\bshar[re]{1,4}\b/i),
	containsDifferentOrAnother: new RegExp(/\b(d[different]{5,}|a[another]{4,})\b/i),
	eastern: new RegExp(/\b(e[eastern]{5,})\b/i),
	central: new RegExp(/\b(c[central]{5,})\b/i),
	pacific: new RegExp(/\b(p[pacific]{5,})\b/i),
	mountain: new RegExp(/\b(m[mountain]{5,})\b/i),
	other: new RegExp(/\b(o[other]{3,})\b/i),
	deleteTasks: new RegExp(/^(d[delete ]{3,}[tasks ]{0,})\b/i),
	containsResetOrUndo: new RegExp(/\b(r[reset]{3,}|u[undo]{2,})\b/i),
	startsWithHelp: new RegExp(/^(hel[elp]{1,4})\b/i),
	containsNoOne: new RegExp(/\b(no one)\b/i),
	somethingElse: new RegExp(/\bsome[omething]{3,}\b.*\bel[lse]{2,}\b/i),
	containsEnough: new RegExp(/\beno[ough]{3,}\b/i),
	containsNew: new RegExp(/\bnew[ew]*\b/i),
	moveOn: new RegExp(/\bmov[ove]*\b.*\bon[n]*\b/i),
	notToday: new RegExp(/\bno[ot]{1,3}\b.*\btod[day]{2,5}\b/i),
	notShare: new RegExp(/\bno[ot]{1,3}\b.*\bsha[areing]{2,5}\b/i),
	containsRename: new RegExp(/\bre[ name]{3,7}\b/i),
	noMore: new RegExp(/^no[o]{0,5}\b.*\bmor[re]{1,4}\b/i),
	redo: new RegExp(/^re[re do]{2,5}\b/i),
	noDontAskAgain: new RegExp(/^no[o]{0,4}\b.*\bas[sk]{1,4}\b.*\baga[ain]{2,5}\b/i),
	yesDontAskAgain: new RegExp(/^yes[s]{0,4}\b.*\bas[sk]{1,4}\b.*\baga[ain]{2,5}\b/i),
	changePriority: new RegExp(/^chang[ge]{1,4}\b|\b(chang[ge]{0,3}|differe[ent]{1,5})\b.*\b(priori[tiyes]{1,5}|tas[sk]{1,5})\b/i),
	goBack: new RegExp(/\bgo[o]{0,5}\b.*\bbac[ck]{1,5}\b/i),
	setTime: new RegExp(/\bset[o]{0,5}\b.*\btim[me]{1,5}\b/i),
	beginAdventure: new RegExp(/\bbegin\b.*\badventure\b/i),
	changeTimeAndTask: new RegExp(/\bchan[nge]{1,5}\b.{1,3}\btim[me]{1,3}\b.{1,7}\btas[sk]{1,3}\b/i),
	keepWorking: new RegExp(/\bkee[ep]{1,3}\b.{1,3}\bwor[king]{1,6}\b/i),
	sendSooner: new RegExp(/\bsen[nd]{1,3}\b.{1,3}\bsoon[ner]{1,4}\b/i),
	containsSendAt: new RegExp(/\bsen[nd]{1,3}\b.{1,3}\bat[t]{0,3}\b/i),
	deferPing: new RegExp(/^def[er]{1,3}\b.{1,3}\bpin[ngs]{1,3}\b/i),
	cancelPing: new RegExp(/^canc[cel]{1,3}\b.{1,3}\bpin[ngs]{1,3}\b/i),
	sendSooner: new RegExp(/^sen[nd]{1,3}\b.{1,3}\bsoon[ner]{1,3}\b/i),
	startsWithFocus: new RegExp(/^focu[us]{1,3}\b/i),
	startsWithFocusOrPriorityOrStatus: new RegExp(/^(focu[us]{1,3}|prior[ity]{1,3}||stat[tus]{1,3})\b/i),
	startsWithPing: new RegExp(/^pin[ng]{1,3}\b/i),
	startsWithDoing: new RegExp(/^doi[ing]{1,3}\b/i)
}


export const constants = {
	dashboardCallBackId: `DASHBOARD_TEAM_PULSE`,
	dashboardActions: `DASHBOARD_ACTIONS_FOR_USER`,
	endSessionTypes: {
		endByPingToUserId: `END_BY_PING_TO_USER_ID`,
		sessionTimerUp: `SESSION_TIMER_UP`,
		endSessionEarly: `END_SESSION_EARLY`
	},
	pingDeliveryTypes: {
		sessionEnd: `sessionEnd`,
		bomb: `bomb`,
		grenade: `grenade`,
		sessionNotIn: `sessionNotIn`
	},
	PLAN_DECISION: {
		complete: {
			word: "TASK_COMPLETE",
			reg_exp: new RegExp(/(\bcomp[omplete]{3,}\b|\bche[heck]{1,}\b|\bcro[ross]{1,}\b)/i)
		},
		add: {
			word: "TASK_ADD",
			reg_exp: new RegExp(/\bad[ad]{1,}\b/i)
		},
		view: {
			word: "TASK_VIEW",
			reg_exp: new RegExp(/\bvi[iew]{1,}\b/i)
		},
		delete: {
			word: "TASK_DELETE",
			reg_exp: new RegExp(/\b(del[elete]{2,8}|rem[move]{2,6})\b/i)
		},
		edit: {
			word: "TASK_EDIT",
			reg_exp: new RegExp(/\bed[dit]{1,}\b/i)
		},
		work: {
			word: "TASK_WORK",
			reg_exp: new RegExp(/\b(do[o]?|wor[ork]{1,})\b/i)
		},
		revise: {
			word: "TASK_REVISE",
			reg_exp: new RegExp(/\brev[ise]{2,4}\b/i)
		}
	},
	FINISH_WORD: {
		word: "done",
		reg_exp: new RegExp(/^d[one]{2,}\b/i)
	},
	 NONE: {
		word: "none",
		reg_exp: new RegExp(/^[none]{3,}e$/i)
	},
	RESET: {
		word: "reset",
		reg_exp: new RegExp(/^r[reset]{3,}\b/i)
	},
	ANY_CHARACTER: {
		reg_exp: new RegExp(/\D/i)
	},
	THANK_YOU: {
		word: "thank you",
		reg_exp: new RegExp(/(^t(?=.*n)[thanks you]{4,}\b|^t(?=.*n)[thanksyou]{5,}\b|^t(?=.*x)[thx]{2,4}\b|^ty[y]{0,}\b)/i)
	},
	DURATION_INTENT: {
		word: "duration",
		reg_exp: new RegExp((/((\b[\d]+( [hoursminutes]+\b|[hoursminutes]+\b))|([forin]{2,}[ ]?[\d]+\b)|(\bh[our]{2,}|\bm[inutes]{2,}))/i))
	},
	TIME_INTENT: {
		word: "time",
		reg_exp: new RegExp((/(:|[at]{2,}[ ]?[\d]+\b)/i))
	},
	MORNING: {
		word: "morning",
		hour: 0
	},
	AFTERNOON: {
		word: "afternoon",
		hour: 14
	},
	EVENING: {
		word: "evening",
		hour: 18
	}
}

export const colorsHash = {
	white: {
		hex: "#ffffff"
	},
	green: {
		hex: "#36a64f"
	},
	lightGreen: {
		hex: "#95B66C"
	},
	darkBlue: {
		hex: "#000057"
	},
	salmon: {
		hex: "#bb4444"
	},
	lightSalmon: {
		hex: "#F1D8DB"
	},
	lavendar: {
		hex: "#6e4474"
	},
	turquoise: {
		hex: "#44bbbb"
	},
	blue: {
		hex: "#3E589D"
	},
	orange: {
		hex: "#E99704"
	},
	grey: {
		hex: "#C1C1C3"
	},
	yellow: {
		hex: "#F0D003"
	},
	toki_purple: {
		hex: "#9370DB"
	},
	toki_yellow: {
		hex: "#FFC72C"
	}
};

var colorsArray = [];
for (var key in colorsHash) {
	colorsArray.push({
		title: key,
		hex: colorsHash[key].hex
	});
}
export { colorsArray };

export const buttonValues ={
	goBack: {
		name: "GO_BACK",
		value: "go back!"
	},
	letsDoIt: {
		name: "LETS_DO_IT",
		value: "lets do it!"
	},
	changeTasks: {
		name: "CHANGE_TASKS",
		value: "change tasks!"
	},
	neverMind: {
		name: "NEVER_MIND",
		value: "never mind!"
	},
	endSession: {
		name: "END_SESSION",
		value: "End Session"
	},
	newSession: {
		name: "NEW_SESSION",
		value: "New session"
	},
	keepWorking: {
		name: "KEEP_WORKING",
		value: "Keep working!"
	},
	changeTimeAndTask: {
		name: "CHANGE_TIME_AND_TASK",
		value: "Change time and task"
	},
	yes: {
		name: "YES",
		value: "Yes"
	},
	no: {
		name: "NO",
		value: "no"
	},
	sendAtEndOfSession: {
		name: "SEND_AT_END_SESSION",
		value: "Send at end of session"
	},
	sendSooner: {
		name: "SEND_SOONER",
		value: "Send sooner"
	},
	now: {
		name: "NOW",
		value: "Now"
	},
	timeZones: {
		eastern: {
			name: "EASTERN",
			value: "Eastern"
		},
		central: {
			name: "CENTRAL",
			value: "Central"
		},
		mountain: {
			name: "MOUNTAIN",
			value: "mountain"
		},
		pacific: {
			name: "PACIFIC",
			value: "Pacific"
		},
		other: {
			name: "OTHER",
			value: "Other"
		}
	},
	focus: {
		name: "FOCUS",
		value: "Focus"
	},
	sendNow: {
		name: "SEND_NOW",
		value: "Send now"
	},
	cancelPing: {
		name: "CANCEL_PING",
		value: "cancel ping"
	},
	deferPing: {
		name: "DEFER_PING",
		value: "defer ping"
	},
	sendSooner: {
		name: "SEND_SOONER",
		value: "send sooner"
	}
}

export const timeZones = {
	eastern: {
		tz: "America/Indiana/Indianapolis",
		name: "Eastern"
	},
	central: {
		tz: "America/Chicago",
		name: "Central"
	},
	mountain: {
		tz: "America/Denver",
		name: "Mountain"
	},
	pacific: {
		tz: "America/Los_Angeles",
		name: "Pacific"
	},
	other: {
		tz: "OTHER",
		name: "Other"
	}
}

export const approvalWords = ['nice', 'awesome', 'sounds good', 'great', 'fantastic', 'looking good', 'very nice', 'cool', 'boom', 'looks good'];

export const startSessionExamples = [
	'think through product development roadmap for 75 min',
	'send supporter update emails for 1 hour',
	'finish first version of website wireframe for 60 min',
	'map out inbound marketing strategy until 10am',
	'write up city research until 1pm',
	'follow up with primary customers until 11:35am',
	'sketch out first version of logo for 1 hr 15 min',
	'update portfolio and send out to mentors for 1hr 30 min'
]


/**
 * 	ATTACHMENTS
 */

export const letsFocusAttachments = [
	{
		attachment_type: 'default',
		callback_id: "LETS_FOCUS_AGAIN",
		fallback: "Let's focus again!",
		actions: [
			{
				name: buttonValues.focus.name,
				text: "Focus :thinking_face:",
				value: buttonValues.focus.value,
				type: "button"
			}
		]
	}
]

export const timeZoneAttachments = [
	{
		attachment_type: 'default',
		callback_id: "ONBOARD",
		fallback: "What's your timezone?",
		color: colorsHash.grey.hex,
		actions: [
			{
				name: buttonValues.timeZones.eastern.name,
				text: `Eastern`,
				value: buttonValues.timeZones.eastern.value,
				type: "button"
			},
			{
				name: buttonValues.timeZones.central.name,
				text: `Central`,
				value: buttonValues.timeZones.central.value,
				type: "button"
			},
			{
				name: buttonValues.timeZones.mountain.name,
				text: `Mountain`,
				value: buttonValues.timeZones.mountain.value,
				type: "button"
			},
			{
				name: buttonValues.timeZones.pacific.name,
				text: `Pacific`,
				value: buttonValues.timeZones.pacific.value,
				type: "button"
			},
			{
				name: buttonValues.timeZones.other.name,
				text: `Other`,
				value: buttonValues.timeZones.other.value,
				type: "button"
			}
		]
	}
]

export const tokiExplainAttachments = [
	{
		title: "Set your current focus",
		text: "In any channel, use the command `/focus` to share your current focus and protect yourself from getting pulled to switch contexts from non-urgent messages while you work. If you finish early, you can use the `/end` command",
		mrkdwn_in: [ "text" ],
		color: colorsHash.toki_purple.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Set my current focus"
	},
	{
		title: "Respect your teammates",
		text: "In any channel, use the command `/pulse @user` to see your teammate's current focus. If you're working on something relevant and want to send a message, I'll push the notification through",
		mrkdwn_in: [ "text" ],
		color: colorsHash.toki_purple.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "See team member's pulse"
	},
	{
		title: "Handle urgent messages",
		text: "In any channel, use the command `/now @user` when you have a truly urgent message to send. I'll push through the notification and start a conversation between you two so you can talk",
		mrkdwn_in: [ "text" ],
		color: colorsHash.toki_purple.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Send urgent messages"
	}
]

export const specialNumbers = ['zeroth','first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelvth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
export const decaNumbers = ['twent', 'thirt', 'fourt', 'fift', 'sixt', 'sevent', 'eight', 'ninet'];

