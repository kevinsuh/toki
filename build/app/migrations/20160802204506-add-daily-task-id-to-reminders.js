'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add DailyTaskId to reminders
    return queryInterface.addColumn('Reminders', 'DailyTaskId', {
      type: Sequelize.INTEGER
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove DailyTaskId from reminders
    return queryInterface.removeColumn('Reminders', 'DailyTaskId');
  }
};
//# sourceMappingURL=20160802204506-add-daily-task-id-to-reminders.js.map