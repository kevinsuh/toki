'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // remove daily task columns from tasks table
    return queryInterface.removeColumn('Teams', 'BotId');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.addColumn('Teams', 'BotId', {
      type: Sequelize.STRING
    });
  }
};
//# sourceMappingURL=20160622204421-remove-bot-id-from-teams.js.map