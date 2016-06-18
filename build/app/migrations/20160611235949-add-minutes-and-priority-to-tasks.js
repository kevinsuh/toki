'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add priority and minutes
    queryInterface.addColumn('Tasks', 'priority', {
      type: Sequelize.INTEGER
    });

    return queryInterface.addColumn('Tasks', 'minutes', {
      type: Sequelize.INTEGER
    });
  },

  down: function down(queryInterface, Sequelize) {

    queryInterface.removeColumn('Tasks', 'priority');

    return queryInterface.removeColumn('Tasks', 'minutes');
  }
};
//# sourceMappingURL=20160611235949-add-minutes-and-priority-to-tasks.js.map