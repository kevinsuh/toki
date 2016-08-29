'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    queryInterface.dropTable('WorkSessionTasks');
    queryInterface.dropTable('DailyTasks');
    queryInterface.dropTable('Tasks');
    queryInterface.dropTable('Includes');
    queryInterface.dropTable('Reminders');
    queryInterface.dropTable('SessionGroups');
    queryInterface.dropTable('SlackUsers');
    queryInterface.dropTable('StoredWorkSessions');
    queryInterface.dropTable('WorkSessions');
    return queryInterface.dropTable('test');
  },

  down: function down(queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.
       Example:
      return queryInterface.dropTable('users');
    */
  }
};
//# sourceMappingURL=20160823144038-purge-db-of-tables-2.js.map