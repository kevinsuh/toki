'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add user reference to session groups
    return queryInterface.addColumn('SessionGroups', 'UserId', {
      type: Sequelize.INTEGER,
      references: 'Users',
      referencesKey: 'id'
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove user reference
    return queryInterface.removeColumn('SessionGroups', 'UserId');
  }
};
//# sourceMappingURL=20160616143403-add-user-reference-to-session-group.js.map