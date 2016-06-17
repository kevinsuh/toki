'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
   return queryInterface.changeColumn(
      'DailyTasks',
      'type',
      {
        type: Sequelize.STRING,
        defaultValue: "live"
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.changeColumn(
      'DailyTasks',
      'type',
      {
        type: Sequelize.STRING
      }
    );
  }
};
