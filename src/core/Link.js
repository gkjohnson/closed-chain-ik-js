/** @import { Joint } from './Joint.js' */
import { Frame } from './Frame.js';

/**
 * A frame modeling a fixed connection between joints. Only joints may be added as children.
 * @extends Frame
 */
export class Link extends Frame {

	constructor() {

		super();
		this.isLink = true;

		/**
		 * Joints connected to this link through `Joint.makeClosure`.
		 * @type {Array<Joint>}
		 * @readonly
		 */
		this.closureJoints = [];

	}

	/**
	 * Adds a joint as a child of this link. Throws if the child is not a joint.
	 * @param {Joint} child
	 */
	addChild( child ) {

		if ( ! child.isJoint ) {

			throw new Error( 'Link: Added child must be a Joint.' );

		} else {

			super.addChild( child );

		}

	}

}
