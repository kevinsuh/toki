'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // make NOT NULL
    return queryInterface.changeColumn('SlackUsers', 'SlackUserId', {
      type: Sequelize.STRING,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {}
};
//# sourceMappingURL=20160610200943-change-column-not-null-slack-user-id.js.map