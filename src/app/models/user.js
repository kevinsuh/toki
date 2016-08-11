import { bot } from '../../server';
import { controller } from '../../bot/controllers';

'use strict';
module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: DataTypes.STRING,
    admin: { type: DataTypes.BOOLEAN,
             defaultValue: false
           },
    nickName: DataTypes.STRING,
    defaultSnoozeTime: DataTypes.INTEGER,
    defaultBreakTime: DataTypes.INTEGER,
    includeOthersDecision: {  type: DataTypes.STRING,
               defaultValue: "default"
          },
    pingTime: { type: DataTypes.DATE
    },
    wantsPing: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
  }, {

    classMethods: {
      associate: function(models) {
        // associations can be defined here
        User.hasMany(models.DailyTask);
        User.hasOne(models.SlackUser, { foreignKey: 'UserId' });
        User.hasMany(models.Reminder);
        User.hasMany(models.WorkSession);
        User.hasMany(models.SessionGroup);
      }
    },

    instanceMethods: {
    }

  });
  return User;
};