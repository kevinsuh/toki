'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // remove daily task columns from tasks table
    return queryInterface.removeColumn('Pings', 'content');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.addColumn('Pings', 'content', {
      type: Sequelize.STRING
    });
  }
};
//# sourceMappingURL=20160824135225-remove-content-from-pings.js.map