import { Joint, DOF } from './Joint.js';

export class Goal extends Joint {

	constructor( ...args ) {

		super( ...args );
		this.isGoal = true;
		this.setFreeDoF();

	}

	setDoF( ...args ) {

		// We don't support rotation goals that only specify 1 or 2 free rotation axes.
		let rotCount =
			Number( args.includes( DOF.EX ) ) +
			Number( args.includes( DOF.EY ) ) +
			Number( args.includes( DOF.EZ ) );

		if ( rotCount !== 0 && rotCount !== 3 ) {

			throw new Error( 'Goal: Only full 3 DoF or 0 DoF rotation goals are supported.' );

		}

		super.setDoF( ...args );

	}

	setGoalDoF( ...args ) {

		this.setDoF( ...args );

	}

	setFreeDoF( ...args ) {

		const freeDoF = [
			DOF.X, DOF.Y, DOF.Z,
			DOF.EX, DOF.EY, DOF.EZ,
		].filter( d => ! args.includes( d ) );
		this.setDoF( ...freeDoF );

	}

	addChild() {

		throw new Error( 'Goal: Cannot add children to Goal.' );

	}

}
