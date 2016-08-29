'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
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

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
  }
};
