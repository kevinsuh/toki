'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Requests', 'type', 'deliveryType');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.renameColumn('Requests', 'deliveryType', 'type');
  }
};
//# sourceMappingURL=20160823195818-change-type-to-delivery-type.js.map