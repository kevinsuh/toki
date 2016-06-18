'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    // make UserId foreign key
    queryInterface.changeColumn('SlackUsers', 'UserId', {
      type: Sequelize.INTEGER,
      references: 'Users',
      referencesKey: 'id'
    });
  },

  down: function down(queryInterface, Sequelize) {
    done();
  }
};
//# sourceMappingURL=20160610204031-add-foreign-key-to-slack-user.js.map