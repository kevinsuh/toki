'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Tasks', 'userID', 'userId');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Tasks', 'userId', 'userID');
  }
};
//# sourceMappingURL=20160610180108-change-name-of-user-column.js.map