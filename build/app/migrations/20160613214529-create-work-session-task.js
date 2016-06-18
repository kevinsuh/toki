'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    return queryInterface.createTable('WorkSessionTasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      WorkSessionId: {
        type: Sequelize.INTEGER,
        references: { model: "WorkSessions", key: "id" }
      },
      DailyTaskId: {
        type: Sequelize.INTEGER,
        references: { model: "DailyTasks", key: "id" }
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
    return queryInterface.dropTable('WorkSessionTasks');
  }
};
//# sourceMappingURL=20160613214529-create-work-session-task.js.map