'use strict';

module.exports = function (sequelize, DataTypes) {
  var SessionGroup = sequelize.define('SessionGroup', {
    type: { type: DataTypes.STRING,
      allowNull: false
    },
    UserId: DataTypes.INTEGER,
    reflection: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        SessionGroup.belongsTo(models.User);
      }
    }
  });
  return SessionGroup;
};
//# sourceMappingURL=sessiongroup.js.map