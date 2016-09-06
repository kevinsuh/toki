'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.addColumn('Channels', 'TeamId', {
      type: Sequelize.STRING
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove user reference
    return queryInterface.removeColumn('Channels', 'TeamId');
  }
};
//# sourceMappingURL=20160906203642-add-references-team-to-channels.js.map