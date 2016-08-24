'use strict';

module.exports = function (sequelize, DataTypes) {
  var Ping = sequelize.define('Ping', {
    FromUserId: DataTypes.INTEGER,
    ToUserId: DataTypes.INTEGER,
    content: DataTypes.STRING,
    type: { type: DataTypes.STRING,
      defaultValue: "live"
    }
  }, {
    classMethods: {
      associate: function associate(models) {
        Ping.belongsTo(models.User);
        Ping.hasMany(models.PingMessage);
      }
    }
  });
  return Ping;
};
//# sourceMappingURL=ping.js.map