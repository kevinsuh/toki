'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _server = require('../../../server');

var _controllers = require('../../../bot/controllers');

var _slackApiHelpers = require('../../../bot/lib/slackApiHelpers');

var _models = require('../../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectDestructuringEmpty(obj) { if (obj == null) throw new TypeError("Cannot destructure undefined"); }

var router = _express2.default.Router();

/**
 *    SLACK USERS CONTROLLER
 *    `/api/v1/slack_users`
 */

// index
router.get('/', function (req, res) {

  // this shows how to use moment-timezone to create timezone specific dates
  if (false) {
    // 2016-06-13T13:55:00.000-04:00
    var timeEST = _momentTimezone2.default.tz("2016-06-13T14:55:00.000", "America/New_York");
    console.log("huh\n\n\n\n\n");

    console.log("\n\n\n\nEST:");
    console.log(timeEST.format("YYYY-MM-DD HH:mm:ss"));
    console.log(timeEST.utc().format("YYYY-MM-DD HH:mm:ss"));

    console.log("\n\n\n\nPST:");
    var timePST = _momentTimezone2.default.tz("2016-06-13T14:55:00.000", "America/Los_Angeles");
    console.log(timePST.format("YYYY-MM-DD HH:mm:ss"));
    console.log(timePST.utc().format("YYYY-MM-DD HH:mm:ss"));
    console.log("OKAY...\n\n\n\n");

    var now = (0, _momentTimezone2.default)();
    var minutesDuration = Math.round(_momentTimezone2.default.duration(timePST.diff(now)).asMinutes());
    console.log('this many minutes difference for 1:55 PST: ' + minutesDuration);

    var minutesDuration = _momentTimezone2.default.duration(timeEST.diff(now)).asMinutes();
    console.log('this many minutes difference for 1:55 EST: ' + minutesDuration);
  }

  if (false) {

    // this shows how you can ORM inserts w/ associations
    var id = 2;
    _models2.default.WorkSession.find({
      where: { id: id }
    }).then(function (workSession) {
      _models2.default.DailyTask.find({
        where: { id: 14 }
      }).then(function (dailyTask) {
        console.log("in daily task!!");
        console.log(dailyTask);
        workSession.setDailyTasks([dailyTask.id]);
      });
    });
  }

  if (false) {
    _models2.default.SlackUser.findAll({
      include: [_models2.default.User]
    }).then(function (slackUsers) {
      res.json(slackUsers);
    });
  }
  var remindTime = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss");
  var UserId = 1;
  var customNote = "test note";

  if (false) {

    // get most recent start session group
    // then make all live tasks below that into pending
    _models2.default.User.find({
      where: { id: UserId }
    }).then(function (user) {
      user.getSessionGroups({
        limit: 1,
        order: '"SessionGroup"."createdAt" DESC',
        where: ['"SessionGroup"."type" = ?', "start_work"]
      }).then(function (sessionGroups) {
        var sessionGroup = sessionGroups[0];
        var sessionGroupCreatedAt = sessionGroup.createdAt;
        // safety measure of making all previous live tasks pending
        user.getDailyTasks({
          where: ['"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?', sessionGroup.createdAt, "pending"]
        }).then(function (dailyTasks) {
          dailyTasks.forEach(function (dailyTask) {
            dailyTask.update({
              type: "archived"
            });
          });
          user.getDailyTasks({
            where: ['"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?', sessionGroup.createdAt, "live"]
          }).then(function (dailyTasks) {
            dailyTasks.forEach(function (dailyTask) {
              dailyTask.update({
                type: "pending"
              });
            });
          });
        });
      });
    });
  }

  var storage = storageCreator();

  var teamId = "T121VLM63";
  var cb = function cb(err, team) {
    console.log("\n\n\nfound team!\n\n\n");
    console.log(team);
  };
  // storage.teams.get("T121VLM63", cb);
  // storage.teams.get("T121VLM63FF", cb);
  // storage.teams.all(cb);

  // storage.users.get("U12NZ0ZC0", cb);
  // storage.users.get("U12NZ0ZC042", cb);
  // storage.users.all(cb);

  // storage.channels.get("D1J6A98JC", cb);
  // storage.channels.get("U12NZ0ZC042", cb);
  // storage.channels.all(cb);

  // storage.teams.save({id:"T24124124"}, cb);
  // storage.users.save({id:"UTESTERR"}, cb);
  // storage.channels.save({id:"DTEST444"}, cb);

  res.json({ "hello": "world" });

  // models.Team.findAll({
  //   limit: 250
  // })
  // .then(cb);

  // const teamData = { id: 'T121VLM63 4114',
  //   bot:
  //    { token: 'xoxb-52208318340-fwvhQnvbbmRctztpuFxrIxdG',
  //      user_id: 'U1J649CA0',
  //      createdBy: 'U121U9CAU' },
  //   createdBy: 'U121U9CAU',
  //   url: 'https://heynavi.slack.com/',
  //   name: 'Navi',
  //   token: 'xoxb-52208318340-fwvhQnvbbmRctztpuFxrIxdG' };
  // const TeamId = teamData.id;
  // const { url, name, token, createdBy } = teamData;
  // models.Team.find({
  //   where: { TeamId }
  // })
  // .then((team) => {
  //   console.log("team is!!");
  //   console.log(team);
  //   console.log(`url: ${url}`);
  //   console.log(`token: ${token}`);
  //   console.log(`name: ${name}`);
  //   console.log(`createdBy: ${createdBy}`);
  //   if (!team) {
  //     console.log("could not find team");
  //     return models.Team.create({
  //       TeamId,
  //       url,
  //       name,
  //       token,
  //       createdBy
  //     });
  //   } else {
  //     console.log("found team");
  //     return team.update({
  //       TeamId,
  //       url,
  //       name,
  //       token,
  //       createdBy
  //     });
  //   }
  // })
  // .then(cb);

  // models.Reminder.create({
  //   remindTime,
  //   UserId,
  //   customNote
  // }).then((reminder) => {
  //   res.json(reminder);
  // });
  // models.Reminder.find({
  //   where: { id: 34 }
  // }).then((reminder) => {
  //   var time = reminder.createdAt;
  //   var timeMoment = moment(time).tz("America/Los_Angeles").format();
  //   var timeMoment = moment(time).tz("America/New_York").format();
  //   res.json({time: timeMoment});
  // })

  var SlackUserId = 'U121ZK15J';
  var UserId = 1;
  // models.User.find({
  //   where: [`"User"."id" = ?`, UserId ],
  //   include: [
  //     models.SlackUser
  //   ]
  // })
  // .then((user) => {
  //   // get the msot start_work session group to measure
  //   // a day's worth of work
  //   user.getSessionGroups({
  //     where: [`"SessionGroup"."type" = ?`, "start_work"],
  //     order: `"SessionGroup"."createdAt" DESC`,
  //     limit: 1
  //   })
  //   .then((sessionGroups) => {

  //     // uh oh error (first time trying to end day)
  //     if (sessionGroups.length == 0) {
  //       console.log("oh no!");
  //     }
  //     console.log(sessionGroups);
  //     res.json(sessionGroups);
  //   })
  // });
  // models.User.find({
  //   where: [`"User"."id" = ?`, UserId ],
  //   include: [
  //     models.SlackUser
  //   ]
  // })
  // .then((user) => {
  //   console.log("\n\n\n\n\n");
  //   console.log(user.nickName);
  //   console.log(user.SlackUser.SlackUserId);
  //   console.log(user.dataValues.SlackUser.SlackUserId);
  //   console.log("\n\n\n\n\n");
  //   return user.getReminders({
  //     where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break"] ]
  //   });
  // })
  // .then((reminders) => {
  //   res.json(reminders);
  // });

  // models.User.find({
  //   where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
  //   include: [
  //     models.SlackUser
  //   ]
  // })
  // .then((user) => {

  //   // cannot start a session if user is already in one!
  //   return user.getWorkSessions({
  //     where: [`"open" = ?`, true ]
  //   })
  //   .then((workSessions) => {
  //     console.log("work sessions!")
  //     console.log(workSessions);

  //     // if (Object.keys(workSessions).length === 0 && workSessions.constructor === Object) {
  //     //   console.log("WORK SESSIONS is empty!");
  //     // } else {
  //     //   console.log("WORK SESSIONS is not empty...");
  //     // }

  //     console.log("user");
  //     console.log(user);
  //   })
  // })

  // seedDatabaseWithExistingSlackUsers(bot);
  console.log("checking session:");
  // checkForSessions();
});

var checkForSessions = function checkForSessions() {

  var today = new Date();
  var fiveMinutesAgo = today.setMinutes(-5);
  console.log(today);
  console.log(fiveMinutesAgo);

  var fiveMinutesAgo = (0, _momentTimezone2.default)().subtract(5, "minutes");
  // console.log(moment().utc().format("YYYY-MM-DD HH:mm:ss"));
  // console.log(fiveMinutesAgo.utc().format("YYYY-MM-DD HH:mm:ss"));
  // console.log(moment().format("YYYY-MM-DD HH:mm:ss"));

  // models.WorkSession.findAll({
  //   where: [ `"endTime" < ? AND open = ?`, fiveMinutesAgo, true ]
  // }).then((workSessions) => {

  //   // these are the work sessions that have ended within last 5 minutes
  //   // and have not closed yet

  //   var workSessionsArray = [];

  //   workSessions.forEach((workSession) => {

  //     const { UserId, open } = workSession;

  //     *
  //      *    For each work session
  //      *      1. close it
  //      *      2. find user and start end_work_session flow

  //     workSession.update({
  //       open: false
  //     })
  //     .then(() => {
  //       return models.User.find({
  //         where: { id: UserId },
  //         include: [ models.SlackUser ]
  //       });
  //     })
  //     .then((user) => {

  //       // start the end session flow!

  //     })

  //   });

  // });
};

function storageCreator(config) {

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
      var SlackUserId = slackUser.dataValues.SlackUserId;

      return {
        id: SlackUserId
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
        console.log(userData);
        var SlackUserId = userData.id;

        _objectDestructuringEmpty(userData);

        console.log('slack user id: ' + SlackUserId);
        _models2.default.SlackUser.find({
          where: { SlackUserId: SlackUserId }
        }).then(function (slackUser) {
          console.log("\n alsfmkalskmf huh?");
          console.log(slackUser);
          if (!slackUser) {
            console.log("could not find slack user... creating now");
            return _models2.default.SlackUser.create({
              SlackUserId: SlackUserId
            });
          } else {
            console.log("found slack user... updating now");
            return slackUser.update({
              SlackUserId: SlackUserId
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
}

// create
router.post('/', function (req, res) {
  var _req$body = req.body;
  var UserId = _req$body.UserId;
  var SlackUserId = _req$body.SlackUserId;


  _models2.default.SlackUser.create({
    SlackUserId: SlackUserId,
    UserId: UserId
  }).then(function (slackUser) {
    res.json(slackUser);
  });
});

// read
router.get('/:slack_user_id', function (req, res) {

  _models2.default.SlackUser.find({
    where: { SlackUserId: req.params.slack_user_id },
    include: [_models2.default.User]
  }).then(function (slackUser) {
    res.json(slackUser);
  });
});

// update
router.put('/:slack_user_id', function (req, res) {});

// delete
router.delete('/:slack_user_id', function (req, res) {});

exports.default = router;
//# sourceMappingURL=slack_users.js.map