'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    queryInterface.addColumn('SlackUsers', 'tz', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('SlackUsers', 'tz');
  }
};
//# sourceMappingURL=20160613062432-add-tz-to-slack-users.js.map