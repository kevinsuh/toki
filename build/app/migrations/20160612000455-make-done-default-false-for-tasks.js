'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // make NOT NULL
    return queryInterface.changeColumn('Tasks', 'done', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });
  },

  down: function down(queryInterface, Sequelize) {}
};
//# sourceMappingURL=20160612000455-make-done-default-false-for-tasks.js.map