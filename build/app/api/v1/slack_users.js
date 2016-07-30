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

var router = _express2.default.Router();

/**
 *    SLACK USERS CONTROLLER
 *    `/api/v1/slack_users`
 */

// index
router.get('/', function (req, res) {

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
  var remindTime = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss Z");
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

  res.json({ "hello": "world" });

  // models.Team.findAll({
  //   limit: 250
  // })
  // .then(cb);

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


  console.log("checking session:");
  // checkForSessions();
});

var checkForSessions = function checkForSessions() {}

// models.WorkSession.findAll({
//   where: [ `"endTime" < ? AND open = ?`, new Date(), true ]
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


// create
;router.post('/', function (req, res) {
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