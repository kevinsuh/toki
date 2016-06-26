'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (config) {

  if (!config) {
    config = {
      path: './'
    };
  }

  var teamObjectToBotkitObject = function teamObjectToBotkitObject(team) {
    if (team) {
      var _team$dataValues = team.dataValues;
      var TeamId = _team$dataValues.TeamId;
      var createdBy = _team$dataValues.createdBy;
      var url = _team$dataValues.url;
      var name = _team$dataValues.name;
      var token = _team$dataValues.token;

      return {
        id: TeamId,
        createdBy: createdBy,
        url: url,
        name: name,
        token: token
      };
    } else {
      return {};
    }
  };

  var userObjectToBotkitObject = function userObjectToBotkitObject(slackUser) {
    if (slackUser) {
      var _slackUser$dataValues = slackUser.dataValues;
      var SlackUserId = _slackUser$dataValues.SlackUserId;
      var tz = _slackUser$dataValues.tz;
      var TeamId = _slackUser$dataValues.TeamId;

      return {
        id: SlackUserId,
        team_id: TeamId,
        tz: tz
      };
    } else {
      return {};
    }
  };

  var channelObjectToBotkitObject = function channelObjectToBotkitObject(channel) {
    if (channel) {
      var ChannelId = channel.dataValues.ChannelId;

      return {
        id: ChannelId
      };
    } else {
      return {};
    }
  };

  var storage = {
    teams: {
      get: function get(TeamId, cb) {
        console.log("\n\n ~~ calling storage.teams.get ~~ \n\n");
        _models2.default.Team.find({
          where: { TeamId: TeamId }
        }).then(function (team) {
          var err = null; // errors in future
          cb(err, teamObjectToBotkitObject(team));
        });
      },
      save: function save(teamData, cb) {
        console.log("\n\n ~~ calling storage.teams.save ~~ \n\n");
        var TeamId = teamData.id;
        var url = teamData.url;
        var name = teamData.name;
        var token = teamData.token;
        var createdBy = teamData.createdBy;

        _models2.default.Team.find({
          where: { TeamId: TeamId }
        }).then(function (team) {
          if (!team) {
            console.log("could not find team... creating now");
            return _models2.default.Team.create({
              TeamId: TeamId,
              url: url,
              name: name,
              token: token,
              createdBy: createdBy
            });
          } else {
            console.log("found team... updating now");
            return team.update({
              TeamId: TeamId,
              url: url,
              name: name,
              token: token,
              createdBy: createdBy
            });
          }
        }).then(function (team) {
          var err = null; // errors in future
          cb(err, teamObjectToBotkitObject(team));
        });
      },
      all: function all(cb) {
        console.log("\n\n ~~ calling storage.teams.all ~~ \n\n");
        _models2.default.Team.findAll({
          limit: 250
        }).then(function (teams) {
          var err = null; // errors in future
          var teamObjects = [];
          teams.forEach(function (team) {
            teamObjects.push(teamObjectToBotkitObject(team));
          });
          cb(err, teamObjects);
        });
      }
    },
    users: {
      get: function get(SlackUserId, cb) {
        console.log("\n\n ~~ calling storage.users.get ~~ \n\n");
        _models2.default.SlackUser.find({
          where: { SlackUserId: SlackUserId }
        }).then(function (user) {
          var err = null; // errors in future
          cb(err, userObjectToBotkitObject(user));
        });
      },
      save: function save(userData, cb) {
        console.log("\n\n ~~ calling storage.users.save ~~ \n\n");

        var SlackUserId = userData.id;
        var TeamId = userData.team_id;
        var tz = userData.tz;
        var nickName = userData.user;
        var accessToken = userData.access_token;
        var scopes = userData.scopes;

        _models2.default.SlackUser.find({
          where: { SlackUserId: SlackUserId }
        }).then(function (slackUser) {

          if (!slackUser) {
            console.log("could not find slack user... creating now");
            /**
             *    NEED TO MAKE AN EMAIL IN THE FUTURE.
             */

            var uniqueEmail = makeid();
            _models2.default.User.create({
              email: 'TEMPEMAILHOLDER' + uniqueEmail + '@gmail.com',
              nickName: nickName
            }).then(function (user) {
              var UserId = user.id;
              return _models2.default.SlackUser.create({
                SlackUserId: SlackUserId,
                UserId: UserId,
                tz: tz,
                TeamId: TeamId
              });
            });
          } else {
            console.log("found slack user... updating now");
            return slackUser.update({
              SlackUserId: SlackUserId,
              TeamId: TeamId
            });
          }
        }).then(function (user) {
          var err = null; // errors in future
          cb(err, userObjectToBotkitObject(user));
        });
      },
      all: function all(cb) {
        console.log("\n\n ~~ calling storage.users.all ~~ \n\n");
        _models2.default.SlackUser.findAll({
          limit: 250
        }).then(function (users) {
          var err = null; // errors in future
          var userObjects = [];
          users.forEach(function (user) {
            userObjects.push(userObjectToBotkitObject(user));
          });
          cb(err, userObjects);
        });
      }
    },
    channels: {
      get: function get(ChannelId, cb) {
        console.log("\n\n ~~ calling storage.channels.get ~~ \n\n");
        _models2.default.Channel.find({
          where: { ChannelId: ChannelId }
        }).then(function (channel) {
          var err = null; // errors in future
          cb(err, channelObjectToBotkitObject(channel));
        });
      },
      save: function save(channelData, cb) {
        console.log("\n\n ~~ calling storage.channels.save ~~ \n\n");
        var ChannelId = channelData.id;

        _objectDestructuringEmpty(channelData);

        _models2.default.Channel.find({
          where: { ChannelId: ChannelId }
        }).then(function (channel) {
          if (!channel) {
            console.log("could not find slack channel... creating now");
            return _models2.default.Channel.create({
              ChannelId: ChannelId
            });
          } else {
            console.log("found slack user... updating now");
            return channel.update({
              ChannelId: ChannelId
            });
          }
        }).then(function (channel) {
          var err = null; // errors in future
          cb(err, channelObjectToBotkitObject(channel));
        });
      },
      all: function all(cb) {
        console.log("\n\n ~~ calling storage.channels.all ~~ \n\n");
        _models2.default.Channel.findAll({
          limit: 250
        }).then(function (channels) {
          var err = null; // errors in future
          var channelObjects = [];
          channels.forEach(function (channel) {
            channelObjects.push(channelObjectToBotkitObject(channel));
          });
          cb(err, channelObjects);
        });
      }
    }
  };

  return storage;
};

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectDestructuringEmpty(obj) { if (obj == null) throw new TypeError("Cannot destructure undefined"); } // custom storage system to use Sequelize
// and have it integrated properly with botkit

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 10; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }return text;
}
//# sourceMappingURL=storage.js.map