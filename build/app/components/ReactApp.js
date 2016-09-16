'use strict';

var React = require('react/addons');

/* create factory with griddle component */
var Griddle = React.createFactory(require('griddle-react'));

var fakeData = require('../data/fakeData.js').fakeData;
var columnMeta = require('../data/columnMeta.js').columnMeta;
var resultsPerPage = 200;

var ReactApp = React.createClass({

  componentDidMount: function componentDidMount() {
    console.log(fakeData);
  },
  render: function render() {
    return React.createElement(
      'div',
      { id: 'table-area' },
      React.createElement(Griddle, { results: fakeData,
        columnMetadata: columnMeta,
        resultsPerPage: resultsPerPage,
        tableClassName: 'table' })
    );
  }
});

/* Module.exports instead of normal dom mounting */
module.exports = ReactApp;
//# sourceMappingURL=ReactApp.js.map