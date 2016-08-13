'use strict';

module.exports = function (sequelize, DataTypes) {
  var SlackUser = sequelize.define('SlackUser', {
    UserId: DataTypes.INTEGER,
    SlackUserId: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    SlackName: DataTypes.STRING,
    tz: DataTypes.STRING,
    TeamId: DataTypes.STRING,
    scopes: DataTypes.STRING,
    accessToken: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        SlackUser.belongsTo(models.User);
        SlackUser.belongsToMany(SlackUser, { as: 'Included', foreignKey: 'IncluderSlackUserId', through: models.Include });
        SlackUser.belongsToMany(SlackUser, { as: 'Includers', foreignKey: 'IncludedSlackUserId', through: models.Include });
      }
    }
  });
  return SlackUser;
};
//# sourceMappingURL=slackuser.js.map