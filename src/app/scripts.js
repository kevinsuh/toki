/**
 * 		For fun one-off thingz
 */

import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import _ from 'lodash';
import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones, tokiExplainAttachments } from '../bot/lib/constants';
import { updateDashboardForChannelId } from '../bot/lib/slackHelpers';

export function seedAndUpdateUsers(members) {

	members.forEach((member) => {

		const { id, team_id, name, tz } = member;

		const SlackUserId = id;

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			if (user) {

				user.update({
					TeamId: team_id,
					SlackName: name
				});
				if (member.profile && member.profile.email) {
					const { profile: { email } } = member;
					if (email && user.email == '') {
						user.update({
							email
						})
					}
				}

			} else {

				console.log("\n\n ~~ new user and creating ~~ \n\n");
				let email = '';
				if (member.profile && member.profile.email)
					email = member.profile.email;
				models.User.create({
					SlackUserId,
					email,
					TeamId: team_id,
					SlackName: name,
				});

			}
		});

	});

}