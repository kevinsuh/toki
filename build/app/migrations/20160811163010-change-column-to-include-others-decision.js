'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    queryInterface.removeColumn('Users', 'dontIncludeOthers');
    queryInterface.addColumn('Users', 'includeOthersDecision', {
      type: Sequelize.STRING,
      defaultValue: "default"
    });
  },
  down: function down(queryInterface, Sequelize) {
    // add dontIncludeOthers bool
    queryInterface.addColumn('Users', 'dontIncludeOthers', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    return queryInterface.removeColumn('Users', 'includeOthersDecision');
  }
};
//# sourceMappingURL=20160811163010-change-column-to-include-others-decision.js.map