'use strict';

module.exports = function (sequelize, DataTypes) {
  var Include = sequelize.define('Include', {
    IncluderSlackUserId: DataTypes.INTEGER,
    IncludedSlackUserId: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return Include;
};
//# sourceMappingURL=include.js.map