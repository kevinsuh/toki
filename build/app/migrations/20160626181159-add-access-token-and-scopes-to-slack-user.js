'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add scopes
    queryInterface.addColumn('SlackUsers', 'scopes', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // add access token
    return queryInterface.addColumn('SlackUsers', 'accessToken', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: function down(queryInterface, Sequelize) {
    queryInterface.removeColumn('SlackUsers', 'scopes');
    return queryInterface.removeColumn('SlackUsers', 'accessToken');
  }
};
//# sourceMappingURL=20160626181159-add-access-token-and-scopes-to-slack-user.js.map