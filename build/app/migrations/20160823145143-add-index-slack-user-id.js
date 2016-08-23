'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    queryInterface.addIndex('Users', ['SlackUserId']);
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
//# sourceMappingURL=20160823145143-add-index-slack-user-id.js.map