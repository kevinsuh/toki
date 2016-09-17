import ReactApp from './components';
import React from 'react';

let mountNode = document.getElementById('react-main-mount');

React.render(new ReactApp({}), mountNode);