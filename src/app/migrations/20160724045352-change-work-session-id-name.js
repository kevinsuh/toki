'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('StoredWorkSessions','workSessionId','WorkSessionId');

  },

  down: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('StoredWorkSessions','WorkSessionId','workSessionId');

  }
};
