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
    accessToken: DataTypes.STRING
  }, {

    classMethods: {
      associate: function(models) {
        User.hasMany(models.Session);
      }
    },

    instanceMethods: {
    }

  });
  return User;
};