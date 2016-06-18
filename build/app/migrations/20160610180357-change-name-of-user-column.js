'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Tasks', 'userId', 'UserId');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Tasks', 'UserId', 'userId');
  }
};
//# sourceMappingURL=20160610180357-change-name-of-user-column.js.map