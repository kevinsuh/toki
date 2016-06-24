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

  var userObjectToBotkitObject = (slackUser) => {
    if (slackUser) {
      const { SlackUserId } = slackUser.dataValues;
      return {
        id: SlackUserId
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
        models.SlackUser.find({
          where: { SlackUserId }
        })
        .then((user) => {
          var err = null; // errors in future
          cb(err, userObjectToBotkitObject(user));
        });
      },
      save: (userData, cb) => {
        console.log("\n\n ~~ calling storage.users.save ~~ \n\n");
        const SlackUserId = userData.id;
        const { } = userData;
        models.SlackUser.find({
          where: { SlackUserId }
        })
        .then((slackUser) => {
          console.log("\n alsfmkalskmf huh?");
          console.log(slackUser);
          if (!slackUser) {
            console.log("could not find slack user... creating now");
            return models.SlackUser.create({
              SlackUserId
            });
          } else {
            console.log("found slack user... updating now");
            return slackUser.update({
              SlackUserId
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
        models.SlackUser.findAll({
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

