'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add dontIncludeOthers bool
    queryInterface.addColumn('Channels', 'tz', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Channels', 'tz');
  }
};
//# sourceMappingURL=20160906145440-add-tz-to-channels.js.map