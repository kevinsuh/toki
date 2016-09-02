'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add dontIncludeOthers bool
   queryInterface.addColumn(
      'Users',
      'dailyRecapTime',
      {
        type: Sequelize.TIME
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Users', 'dailyRecapTime');

  }
};
