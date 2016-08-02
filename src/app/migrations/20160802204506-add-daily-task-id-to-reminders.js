'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add DailyTaskId to reminders
   return queryInterface.addColumn(
      'Reminders',
      'DailyTaskId',
      {
        type: Sequelize.INTEGER
      }
    );

  },

  down: function (queryInterface, Sequelize) {

   // remove DailyTaskId from reminders
   return queryInterface.removeColumn('Reminders', 'DailyTaskId');

  }
};
