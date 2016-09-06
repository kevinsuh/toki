'use strict';
module.exports = function(sequelize, DataTypes) {
  var Channel = sequelize.define('Channel', {
    ChannelId: DataTypes.STRING,
    tz: DataTypes.STRING,
    TeamId: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Channel;
};