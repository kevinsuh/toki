import { bot } from '../../server';
import { controller } from '../../bot/controllers';

'use strict';
module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: DataTypes.STRING,
    admin: { type: DataTypes.BOOLEAN,
             defaultValue: false
           },
    nickName: DataTypes.STRING
  }, {

    classMethods: {
      associate: function(models) {
        // associations can be defined here
        User.hasMany(models.Task);
        User.hasOne(models.SlackUser, { foreignKey: 'UserId' });
        User.hasMany(models.Reminder);
      }
    },

    instanceMethods: {
    }

  });
  return User;
};