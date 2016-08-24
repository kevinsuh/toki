'use strict';
module.exports = function(sequelize, DataTypes) {
  var PingMessage = sequelize.define('PingMessage', {
    PingId: DataTypes.INTEGER,
    content: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        PingMessage.belongsTo(models.Ping);
      }
    }
  });
  return PingMessage;
};