'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Requests','type','deliveryType');

  },

  down: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Requests','deliveryType','type');

  }
};
