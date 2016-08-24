'use strict';

module.exports = {

  up: function up(queryInterface, Sequelize) {

    queryInterface.addColumn('Pings', 'live', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });

    return queryInterface.changeColumn('Pings', 'deliveryType', {
      type: Sequelize.STRING,
      defaultValue: "sessionEnd"
    });
  },
  down: function down(queryInterface, Sequelize) {

    queryInterface.removeColumn('Pings', 'live');
    return queryInterface.changeColumn('Pings', 'deliveryType', {
      type: Sequelize.STRING,
      defaultValue: "live"
    });
  }
};
//# sourceMappingURL=20160824192221-add-live-to-ping.js.map