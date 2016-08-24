'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  return queryInterface.addColumn(
    'Pings',
    'pingTime',
    {
      type: Sequelize.DATE,
    }
  );

},
down: function (queryInterface, Sequelize) {
   
   return queryInterface.removeColumn('Pings', 'pingTime');

  }
};

