'use strict';

module.exports = function (sequelize, DataTypes) {
  var Channel = sequelize.define('Channel', {
    ChannelId: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return Channel;
};
//# sourceMappingURL=channel.js.map