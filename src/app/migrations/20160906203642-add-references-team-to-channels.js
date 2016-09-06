'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   return queryInterface.addColumn(
      'Channels',
      'TeamId',
      {
        type: Sequelize.STRING
      }
    );

  },

  down: function (queryInterface, Sequelize) {

    // remove user reference
   return queryInterface.removeColumn('Channels', 'TeamId');
  

  }
};
