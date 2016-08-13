'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add minutesSpent to dailyTask

   return queryInterface.addColumn(
      'DailyTasks',
      'minutesSpent',
      {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      }
    );


  },

  down: function (queryInterface, Sequelize) {
  
   // remove minutesSpent from dailyTask
   return queryInterface.removeColumn('DailyTasks', 'minutesSpent');

  }
};
