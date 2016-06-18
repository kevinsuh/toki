'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    // add userID
    return queryInterface.changeColumn('Tasks', 'userID', {
      type: Sequelize.INTEGER,
      references: {
        model: "Users",
        key: "id"
      },
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {
    done();
  }
};
//# sourceMappingURL=20160610174345-change-tasks-references.js.map