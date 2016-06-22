'use strict';

module.exports = function (sequelize, DataTypes) {
  var Bot = sequelize.define('Bot', {
    token: DataTypes.STRING,
    BotId: DataTypes.STRING,
    createdBy: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        // Bot.hasMany(models.Team);
      }
    }
  });
  return Bot;
};
//# sourceMappingURL=bot.js.map