'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    // make UserId foreign key
    queryInterface.changeColumn('SlackUsers', 'UserId', {
      type: Sequelize.INTEGER
    });
  },

  down: function down(queryInterface, Sequelize) {
    done();
  }
};

// references: {
//           model: "Users",
//           key: "id"
//         }
//# sourceMappingURL=20160610204436-add-foreign-key-to-slack-user.js.map