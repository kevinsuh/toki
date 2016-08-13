'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add dontIncludeOthers bool
    queryInterface.addColumn('Users', 'dontIncludeOthers', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'dontIncludeOthers');
  }
};
//# sourceMappingURL=20160811155334-add-dont-include-others-to-users.js.map