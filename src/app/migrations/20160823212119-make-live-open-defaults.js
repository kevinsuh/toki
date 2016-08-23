'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
   queryInterface.changeColumn(
      'Requests',
      'deliveryType',
      {
        type: Sequelize.STRING,
        defaultValue: "live"
      }
    );

   queryInterface.changeColumn(
      'Sessions',
      'live',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      }
    );

   return queryInterface.changeColumn(
      'Sessions',
      'open',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    queryInterface.changeColumn(
      'Requests',
      'deliveryType',
      {
        type: Sequelize.STRING
      }
    );

    queryInterface.changeColumn(
      'Sessions',
      'live',
      {
        type: Sequelize.BOOLEAN
      }
    );

   return queryInterface.changeColumn(
      'Sessions',
      'open',
      {
        type: Sequelize.BOOLEAN
      }
    );

  }
};
