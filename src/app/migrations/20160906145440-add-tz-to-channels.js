'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add dontIncludeOthers bool
   queryInterface.addColumn(
      'Channels',
      'tz',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Channels', 'tz');

  }
};
