'use strict';

module.exports = function (sequelize, DataTypes) {
  var BetaList = sequelize.define('BetaList', {
    email: DataTypes.STRING
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return BetaList;
};
//# sourceMappingURL=betalist.js.map