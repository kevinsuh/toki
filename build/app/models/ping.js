'use strict';

module.exports = function (sequelize, DataTypes) {
  var Ping = sequelize.define('Ping', {
    FromUserId: DataTypes.INTEGER,
    ToUserId: DataTypes.INTEGER,
    deliveryType: { type: DataTypes.STRING,
      defaultValue: "sessionEnd"
    },
    pingTime: DataTypes.DATE,
    live: { type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    classMethods: {
      associate: function associate(models) {
        Ping.belongsTo(models.User, { as: 'FromUser', foreignKey: 'FromUserId' });
        Ping.belongsTo(models.User, { as: 'ToUser', foreignKey: 'ToUserId' });
        Ping.hasMany(models.PingMessage);
      }
    }
  });
  return Ping;
};
//# sourceMappingURL=ping.js.map