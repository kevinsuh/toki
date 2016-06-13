'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add open bool
   queryInterface.addColumn(
      'SlackUsers',
      'tz',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('SlackUsers', 'tz');

  }
};
