'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    // add default snooze
   return queryInterface.addColumn(
      'Users',
      'defaultSnoozeTime',
      {
        type: Sequelize.INTEGER,
        allowNull: true
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'defaultSnoozeTime');
  }
};
