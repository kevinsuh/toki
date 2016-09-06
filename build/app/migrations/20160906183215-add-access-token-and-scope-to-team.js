'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    queryInterface.addColumn('Teams', 'scopes', {
      type: Sequelize.STRING
    });

    return queryInterface.addColumn('Teams', 'accessToken', {
      type: Sequelize.STRING
    });
  },

  down: function down(queryInterface, Sequelize) {

    queryInterface.removeColumn('Teams', 'scopes');
    return queryInterface.removeColumn('Teams', 'accessToken');
  }
};
//# sourceMappingURL=20160906183215-add-access-token-and-scope-to-team.js.map