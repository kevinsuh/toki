'use strict';
module.exports = function(sequelize, DataTypes) {
  var Team = sequelize.define('Team', {
    TeamId: DataTypes.STRING,
    createdBy: DataTypes.STRING,
    url: DataTypes.STRING,
    name: DataTypes.STRING,
    token: DataTypes.STRING,
    scopes: DataTypes.STRING,
    accessToken: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // Team.belongsTo(models.Bot, { foreignKey: 'token' });
      }
    }
  });
  return Team;
};