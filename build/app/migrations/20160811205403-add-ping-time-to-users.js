'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add dontIncludeOthers bool
    queryInterface.addColumn('Users', 'pingTime', {
      type: Sequelize.TIME
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'pingTime');
  }
};
//# sourceMappingURL=20160811205403-add-ping-time-to-users.js.map