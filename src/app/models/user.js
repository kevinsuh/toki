import { bot } from '../../server';
import { controller } from '../../bot/controllers';

'use strict';
module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: DataTypes.STRING,
    admin: { type: DataTypes.BOOLEAN,
             defaultValue: false
           },
    SlackUserId: {
      type: DataTypes.STRING
    },
    SlackName: DataTypes.STRING,
    tz: DataTypes.STRING,
    TeamId: DataTypes.STRING,
    scopes: DataTypes.STRING,
    accessToken: DataTypes.STRING,
    dailyRecapTime: DataTypes.DATE,
    wantsDailyRecap: {
             type: DataTypes.BOOLEAN,
             defaultValue: true
          }
  }, {

    classMethods: {
      associate: function(models) {
        User.hasMany(models.Session);
        User.hasMany(models.Ping, { foreignKey: 'FromUserId', as: 'FromUser' });
        User.hasMany(models.Ping, { foreignKey: 'ToUserId', as: 'ToUser' });
      }
    },

    instanceMethods: {
    }

  });
  return User;
};