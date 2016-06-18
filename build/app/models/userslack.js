'use strict';

module.exports = function (sequelize, DataTypes) {
  var UserSlack = sequelize.define('UserSlack', {
    UserId: DataTypes.INTEGER,
    SlackUserId: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return UserSlack;
};
//# sourceMappingURL=userslack.js.map