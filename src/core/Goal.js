import { DOF } from './Joint.js';
import { Frame } from './Frame.js';

export class Goal extends Frame {

	constructor( ...args ) {

		super( ...args );
		this.isGoal = true;
	}

	setFreeDoF( ...args ) {

		this.setFreeDoF( ...args );

	}

	setGoalDoF( ...args ) {

		const freeDoF = [
			DOF.X, DOF.Y, DOF.Z,
			DOF.EX, DOF.EY, DOF.EZ,
		].filter( d => ! args.includes( d ) );
		this.setFreeDoF( ...freeDoF );

	}

	makeClosure( child ) {

		if ( ! child.isLink || this.children.length >= 1 || child.parent === this ) {

			throw new Error();

		} else {

			this.children[ 0 ] = child;
			this.child = child;
			this.isClosure = true;

		}

	}

	addChild() {

		throw new Error();

	}

}
