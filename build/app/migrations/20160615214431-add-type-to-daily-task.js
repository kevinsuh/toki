'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add type to reminders
    return queryInterface.addColumn('DailyTasks', 'type', {
      type: Sequelize.STRING
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove type from reminders
    return queryInterface.removeColumn('DailyTasks', 'type');
  }
};
//# sourceMappingURL=20160615214431-add-type-to-daily-task.js.map