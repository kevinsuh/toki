import React from 'react';
import { Component } from 'react';

export default class ReactApp extends Component {

	componentDidMount() {
		console.log(`\n\n\n component mounted baby!`);
	}

	render() {
		return (
			<div style={{margin:"50px"}}>
				<h1>Hello world!!! YEAH!</h1>
			</div>
		);

	}
}