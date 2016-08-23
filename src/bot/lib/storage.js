// custom storage system to use Sequelize
// and have it integrated properly with botkit

import models from '../../app/models';

export default function(config) {

	if (!config) {
		config = {
			path: './'
		};
	}

	var teamObjectToBotkitObject = (team) => {
		if (team) {
			const { TeamId, createdBy, url, name, token} = team.dataValues;
			return {
				id: TeamId,
				createdBy,
				url,
				name,
				token
			}
		} else {
			return {};
		}
	}

	var userObjectToBotkitObject = (user) => {
		if (user) {
			const { SlackUserId, tz, TeamId, scopes, accessToken } = user.dataValues;
			return {
				id: SlackUserId,
				team_id: TeamId,
				tz,
				scopes,
				access_token: accessToken
			}
		} else {
			return {};
		}
	}

	var channelObjectToBotkitObject = (channel) => {
		if (channel) {
			const { ChannelId } = channel.dataValues;
			return {
				id: ChannelId
			}
		} else {
			return {};
		}
	}

	var storage = {
		teams: {
			get: (TeamId, cb) => {
				console.log("\n\n ~~ calling storage.teams.get ~~ \n\n");
				models.Team.find({
					where: { TeamId }
				})
				.then((team) => {
					var err = null; // errors in future
					cb(err, teamObjectToBotkitObject(team));
				});
			},
			save: (teamData, cb) => {
				console.log("\n\n ~~ calling storage.teams.save ~~ \n\n");
				const TeamId = teamData.id;
				const { url, name, token, createdBy } = teamData;
				models.Team.find({
					where: { TeamId }
				})
				.then((team) => {
					if (!team) {
						console.log("could not find team... creating now");
						return models.Team.create({
							TeamId,
							url,
							name,
							token,
							createdBy
						});
					} else {
						console.log("found team... updating now");
						return team.update({
							TeamId,
							url,
							name,
							token,
							createdBy
						});
					}
				})
				.then((team) => {
					var err = null; // errors in future
					cb(err, teamObjectToBotkitObject(team));
				});
			},
			all: (cb) => {
				console.log("\n\n ~~ calling storage.teams.all ~~ \n\n");
				models.Team.findAll({
					limit: 250
				})
				.then((teams) => {
					var err = null; // errors in future
					var teamObjects = [];
					teams.forEach((team) => {
						teamObjects.push(teamObjectToBotkitObject(team));
					})
					cb(err, teamObjects);
				});
			}
		},
		users: {
			get: (SlackUserId, cb) => {
				console.log("\n\n ~~ calling storage.users.get ~~ \n\n");
				models.User.find({
					where: { SlackUserId }
				})
				.then((user) => {
					var err = null; // errors in future
					cb(err, userObjectToBotkitObject(user));
				});
			},
			save: (userData, cb) => {
				
				console.log("\n\n ~~ calling storage.users.save ~~ \n\n");
				console.log(userData);

				const SlackUserId = userData.id;
				const accessToken = userData.access_token;
				const scopes      = userData.scopes;
				const TeamId      = userData.team_id;
				const nickName    = userData.user;

				models.User.find({
					where: { SlackUserId }
				})
				.then((user) => {

					if (!user) {
						console.log("could not find user... creating now");

						/**
						 *    NEED TO MAKE AN EMAIL IN THE FUTURE.
						 */
						models.User.create({
							SlackUserId,
							TeamId,
							accessToken,
							scopes,
							nickName
						});

					} else {
						console.log("found slack user... updating now");
						return user.update({
							TeamId,
							accessToken,
							scopes
						});
					}

				})
				.then((user) => {
					var err = null; // errors in future
					cb(err, userObjectToBotkitObject(user));
				});
			},
			all: (cb) => {
				console.log("\n\n ~~ calling storage.users.all ~~ \n\n");
				models.User.findAll({
					limit: 250
				})
				.then((users) => {
					var err = null; // errors in future
					var userObjects = [];
					users.forEach((user) => {
						userObjects.push(userObjectToBotkitObject(user));
					})
					cb(err, userObjects);
				});
			}
		},
		channels: {
			get: (ChannelId, cb) => {
				console.log("\n\n ~~ calling storage.channels.get ~~ \n\n");
				models.Channel.find({
					where: { ChannelId }
				})
				.then((channel) => {
					var err = null; // errors in future
					cb(err, channelObjectToBotkitObject(channel));
				});
			},
			save: (channelData, cb) => {
				console.log("\n\n ~~ calling storage.channels.save ~~ \n\n");
				const ChannelId = channelData.id;
				const { } = channelData;
				models.Channel.find({
					where: { ChannelId }
				})
				.then((channel) => {
					if (!channel) {
						console.log("could not find slack channel... creating now");
						return models.Channel.create({
							ChannelId
						});
					} else {
						console.log("found slack user... updating now");
						return channel.update({
							ChannelId
						});
					}
				})
				.then((channel) => {
					var err = null; // errors in future
					cb(err, channelObjectToBotkitObject(channel));
				});
			},
			all: (cb) => {
				console.log("\n\n ~~ calling storage.channels.all ~~ \n\n");
				models.Channel.findAll({
					limit: 250
				})
				.then((channels) => {
					var err = null; // errors in future
					var channelObjects = [];
					channels.forEach((channel) => {
						channelObjects.push(channelObjectToBotkitObject(channel));
					})
					cb(err, channelObjects);
				});
			}
		}
	}

	return storage;

}

function makeid()
{
		var text = "";
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		for( var i=0; i < 10; i++ )
				text += possible.charAt(Math.floor(Math.random() * possible.length));

		return text;
}
