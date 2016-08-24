'use strict';

module.exports = {

  up: function (queryInterface, Sequelize) {

    queryInterface.addColumn(
      'Pings',
      'live',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
    );

    return queryInterface.changeColumn(
      'Pings',
      'deliveryType',
      {
        type: Sequelize.STRING,
        defaultValue: "sessionEnd"
      })

  },
down: function (queryInterface, Sequelize) {
   
   queryInterface.removeColumn('Pings', 'live');
   return queryInterface.changeColumn(
      'Pings',
      'deliveryType',
      {
        type: Sequelize.STRING,
        defaultValue: "live"
      })

  }
};

