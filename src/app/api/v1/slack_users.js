import request from 'request';
import express from 'express';
import pg from 'pg';
import moment from 'moment-timezone';

var router = express.Router();

import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';
import { getTimeZoneOffsetForUser, seedDatabaseWithExistingSlackUsers } from '../../../bot/lib/slackApiHelpers';
import models from '../../models';

/**
 *    SLACK USERS CONTROLLER
 *    `/api/v1/slack_users`
 */

// index
router.get('/', (req, res) => {

// this shows how to use moment-timezone to create timezone specific dates
if (false) {
  // 2016-06-13T13:55:00.000-04:00
  var timeEST = moment.tz("2016-06-13T14:55:00.000", "America/New_York");
  console.log("huh\n\n\n\n\n");

  console.log("\n\n\n\nEST:")
  console.log(timeEST.format("YYYY-MM-DD HH:mm:ss"));
  console.log(timeEST.utc().format("YYYY-MM-DD HH:mm:ss"));

  console.log("\n\n\n\nPST:")
  var timePST = moment.tz("2016-06-13T14:55:00.000", "America/Los_Angeles");
  console.log(timePST.format("YYYY-MM-DD HH:mm:ss"));
  console.log(timePST.utc().format("YYYY-MM-DD HH:mm:ss"));
  console.log("OKAY...\n\n\n\n")

  var now = moment();
  var minutesDuration = Math.round(moment.duration(timePST.diff(now)).asMinutes());
  console.log(`this many minutes difference for 1:55 PST: ${minutesDuration}`);

  var minutesDuration = moment.duration(timeEST.diff(now)).asMinutes();
  console.log(`this many minutes difference for 1:55 EST: ${minutesDuration}`);
}

if (false) {

  // this shows how you can ORM inserts w/ associations
  const id = 2;
  models.WorkSession.find({
    where: { id }
  }).then((workSession) => {
    models.DailyTask.find({
      where: { id: 14 }
    }).then((dailyTask) => {
      console.log("in daily task!!");
      console.log(dailyTask);
      workSession.setDailyTasks([dailyTask.id]);
    });
  });

}

if (false) {
  models.SlackUser.findAll({
  	include: [models.User]
  }).then((slackUsers) => {
    res.json(slackUsers);
  });
} 
var remindTime = moment().format("YYYY-MM-DD HH:mm:ss");
var UserId = 1;
var customNote = "test note";

// get most recent start session group
// then make all live tasks below that into pending
models.User.find({
  where: { id: UserId }
})
.then((user) => {
  user.getSessionGroups({
    limit: 1,
    order: `"SessionGroup"."createdAt" DESC`,
    where: [ `"SessionGroup"."type" = ?`, "start_work"]
  })
  .then((sessionGroups) => {
    var sessionGroup = sessionGroups[0];
    var sessionGroupCreatedAt = sessionGroup.createdAt;
    // safety measure of making all previous live tasks pending
    user.getDailyTasks({
      where: [`"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?`, sessionGroup.createdAt, "pending"]
    })
    .then((dailyTasks) => {
      dailyTasks.forEach((dailyTask) => {
        dailyTask.update({
          type: "archived"
        });
      });
      user.getDailyTasks({
        where: [`"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?`, sessionGroup.createdAt, "live"]
      })
      .then((dailyTasks) => {
        dailyTasks.forEach((dailyTask) => {
          dailyTask.update({
            type: "pending"
          });
        });
      });
    });
  })
})



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

var checkForSessions = () => {

  var today = new Date();
  var fiveMinutesAgo = today.setMinutes(-5);
  console.log(today);
  console.log(fiveMinutesAgo);

  var fiveMinutesAgo = moment().subtract(5, "minutes");
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
}

// create
router.post('/', (req, res) => {
  
	const { UserId, SlackUserId } = req.body;

  models.SlackUser.create({
    SlackUserId,
    UserId
  }).then((slackUser) => {
    res.json(slackUser);
  });

});

// read
router.get('/:slack_user_id', (req, res) => {

	models.SlackUser.find({
		where: { SlackUserId: req.params.slack_user_id },
		include: [
			models.User
		]
	}).then((slackUser) => {
		res.json(slackUser);
	})

});

// update
router.put('/:slack_user_id', (req, res) => {
});

// delete
router.delete('/:slack_user_id', (req, res) => {
});

export default router;