'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    // add userID
    return queryInterface.changeColumn(
      'Tasks',
      'userID',
      {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id"
        },
        allowNull: false
      }
    );
    
  },

  down: function (queryInterface, Sequelize) {
    done();
  }
};
