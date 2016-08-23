'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    queryInterface.changeColumn('Requests', 'deliveryType', {
      type: Sequelize.STRING,
      defaultValue: "live"
    });

    queryInterface.changeColumn('Sessions', 'live', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    return queryInterface.changeColumn('Sessions', 'open', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });
  },

  down: function down(queryInterface, Sequelize) {
    queryInterface.changeColumn('Requests', 'deliveryType', {
      type: Sequelize.STRING
    });

    queryInterface.changeColumn('Sessions', 'live', {
      type: Sequelize.BOOLEAN
    });

    return queryInterface.changeColumn('Sessions', 'open', {
      type: Sequelize.BOOLEAN
    });
  }
};
//# sourceMappingURL=20160823212119-make-live-open-defaults.js.map