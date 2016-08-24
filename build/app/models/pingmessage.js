'use strict';

module.exports = function (sequelize, DataTypes) {
  var PingMessage = sequelize.define('PingMessage', {
    PingId: DataTypes.INTEGER,
    content: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return PingMessage;
};
//# sourceMappingURL=pingmessage.js.map