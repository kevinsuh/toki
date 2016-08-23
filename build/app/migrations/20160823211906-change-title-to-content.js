'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Sessions', 'title', 'content');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Sessions', 'title', 'content');
  }
};
//# sourceMappingURL=20160823211906-change-title-to-content.js.map