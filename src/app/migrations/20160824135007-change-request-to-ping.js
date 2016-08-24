'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.renameTable('Requests', 'Pings')
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.renameTable('Pings', 'Requests')
  }
};
