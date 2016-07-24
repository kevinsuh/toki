'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    return queryInterface.removeColumn('StoredWorkSessions', 'resumed');

   
  },

  down: function (queryInterface, Sequelize) {
 
   // add open bool
   return queryInterface.addColumn(
      'StoredWorkSessions',
      'resumed',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    );

  }
};
