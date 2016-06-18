'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // remove daily task columns from tasks table
    queryInterface.removeColumn('Tasks', 'UserId');

    return queryInterface.addColumn('DailyTasks', 'UserId', {
      type: Sequelize.INTEGER,
      references: 'Users',
      referencesKey: 'id'
    });
  },

  down: function down(queryInterface, Sequelize) {

    queryInterface.addColumn('Tasks', 'UserId', {
      type: Sequelize.INTEGER,
      references: 'Users',
      referencesKey: 'id'
    });

    return queryInterface.removeColumn('DailyTasks', 'UserId');
  }
};
//# sourceMappingURL=20160614194018-remove-user-id-from-tasks-add-user-id-daily-tasks.js.map