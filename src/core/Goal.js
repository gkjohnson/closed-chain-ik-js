import { DOF_NAMES, DOF } from './Joint.js';
import { Frame } from './Frame.js';

// TODO: we should just extend Joint here...
export class Goal extends Frame {

	constructor( ...args ) {

		super( ...args );
		this.isGoal = true;
		this.isJoint = true;

		this.freeDoF = [];
		this.child = null;
		this.isClosure = false;

	}

	setFreeDoF( ...args ) {

		args.forEach( ( dof, i ) => {

			if ( dof < 0 || dof >= 6 ){

				throw new Error( 'Goal: Invalid degree of freedom enum ' + dof + '.' );

			}

			if ( args.includes( dof, i + 1 ) ) {

				throw new Error( 'Goal: Duplicate degree of freedom ' + DOF_NAMES[ dof ] + 'specified.' );

			}

			if ( i !== 0 && args[ i - 1 ] > dof ) {

				throw new Error( 'Goal: Joints degrees of freedom must be specified in position then rotation, XYZ order' );
			}

		} );

		this.freeDoF = args;

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

	removeChild( child ) {

		super.removeChild( child );
		this.child = null;
		this.isClosure = false;

	}

	addChild() {

		throw new Error();

	}

}
