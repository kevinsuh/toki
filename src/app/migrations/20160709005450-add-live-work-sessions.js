'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add live to worksessions
   queryInterface.addColumn(
      'WorkSessions',
      'live',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('WorkSessions', 'live');

  }
};
