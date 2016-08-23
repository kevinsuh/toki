'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.dropTable('SlackConversations1');
    return queryInterface.dropTable('SlackConversations');
  },

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
  }
};
