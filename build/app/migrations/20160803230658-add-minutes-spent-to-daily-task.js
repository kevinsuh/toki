'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add minutesSpent to dailyTask

    return queryInterface.addColumn('DailyTasks', 'minutesSpent', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove minutesSpent from dailyTask
    return queryInterface.removeColumn('DailyTasks', 'minutesSpent');
  }
};
//# sourceMappingURL=20160803230658-add-minutes-spent-to-daily-task.js.map