'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    // add user reference to session groups
    return queryInterface.addColumn('SlackUsers', 'TeamId', {
      type: Sequelize.STRING
    });
  },

  down: function down(queryInterface, Sequelize) {
    return queryInterface.removeColumn('SlackUsers', 'TeamId');
  }
};
//# sourceMappingURL=20160626013442-add-team-id-to-slack-user.js.map