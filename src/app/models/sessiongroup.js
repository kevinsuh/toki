'use strict';
module.exports = function(sequelize, DataTypes) {
  var SessionGroup = sequelize.define('SessionGroup', {
    type: {  type: DataTypes.STRING,
             allowNull: false
          },
    UserId: DataTypes.INTEGER,
    reflection: DataTypes.STRING,
    wonDay: {  type: DataTypes.BOOLEAN,
               defaultValue: true
          }
  }, {
    classMethods: {
      associate: function(models) {
        SessionGroup.belongsTo(models.User);
      }
    }
  });
  return SessionGroup;
};