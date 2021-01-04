import { Frame } from './Frame.js';

export class Link extends Frame {

	constructor() {

		super();
		this.isLink = true;
		this.closureJoints = [];

	}

	addChild( child ) {

		if ( ! child.isJoint ) {

			throw new Error( 'Link: Added child must be a Joint.' );

		} else {

			super.addChild( child );

		}

	}

}
