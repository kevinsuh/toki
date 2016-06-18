'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add user reference to session groups
    return queryInterface.addColumn('SessionGroups', 'reflection', {
      type: Sequelize.TEXT
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove user reference
    return queryInterface.removeColumn('SessionGroups', 'reflection');
  }
};
//# sourceMappingURL=20160616160310-add-reflection-to-session-group.js.map