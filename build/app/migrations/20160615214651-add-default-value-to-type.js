'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.changeColumn('DailyTasks', 'type', {
      type: Sequelize.STRING,
      defaultValue: "live"
    });
  },

  down: function down(queryInterface, Sequelize) {
    return queryInterface.changeColumn('DailyTasks', 'type', {
      type: Sequelize.STRING
    });
  }
};
//# sourceMappingURL=20160615214651-add-default-value-to-type.js.map