'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Sessions','title','content');

  },

  down: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Sessions','title','content');

  }
};
