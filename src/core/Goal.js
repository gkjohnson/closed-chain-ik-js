import { Joint, DOF } from './Joint.js';

/**
 * A frame representing a target for a connected link to reach. The degrees of freedom set on
 * a goal are the axes that are constrained, as opposed to the movable degrees of freedom of a
 * joint. A goal cannot have children and can only be connected to a link with `makeClosure`.
 *
 * ```js
 * goal.setFreeDoF();                          // all axes constrained ( default )
 * goal.setFreeDoF( DOF.EX, DOF.EY, DOF.EZ );  // position only goal
 * goal.setGoalDoF( DOF.X, DOF.Y, DOF.Z );     // position only goal
 * ```
 * @extends Joint
 */
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

	/**
	 * Sets the axes the goal constrains. Rotation must be constrained on all three axes or
	 * none, so `EX`, `EY`, and `EZ` must be passed together or omitted.
	 * @param {...number} dof - The constrained `DOF` fields.
	 */
	setGoalDoF( ...args ) {

		this.setDoF( ...args );

	}

	/**
	 * Sets the axes the goal leaves free. Every other axis is constrained. The same rotation
	 * restriction as `setGoalDoF` applies.
	 * @param {...number} dof - The free `DOF` fields.
	 */
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
