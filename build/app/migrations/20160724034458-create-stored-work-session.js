'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    return queryInterface.createTable('StoredWorkSessions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      workSessionId: {
        type: Sequelize.INTEGER,
        references: { model: "WorkSessions", key: "id" }
      },
      minutes: {
        type: Sequelize.DOUBLE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function down(queryInterface, Sequelize) {
    return queryInterface.dropTable('StoredWorkSessions');
  }
};
//# sourceMappingURL=20160724034458-create-stored-work-session.js.map