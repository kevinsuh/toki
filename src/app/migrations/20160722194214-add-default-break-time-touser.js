'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    // add default breaktime
   return queryInterface.addColumn(
      'Users',
      'defaultBreakTime',
      {
        type: Sequelize.INTEGER,
        allowNull: true
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'defaultBreakTime');
  }
};
