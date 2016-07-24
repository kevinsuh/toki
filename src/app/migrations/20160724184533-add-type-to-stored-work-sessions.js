'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add open bool
   return queryInterface.addColumn(
      'StoredWorkSessions',
      'live',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('StoredWorkSessions', 'live');

  }
};
