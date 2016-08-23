'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    queryInterface.dropTable('SlackConversations1');
    return queryInterface.dropTable('SlackConversations');
  },

  down: function down(queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.
       Example:
      return queryInterface.dropTable('users');
    */
  }
};
//# sourceMappingURL=20160823144409-purge-db-of-tables-3.js.map