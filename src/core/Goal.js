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

	addChild() {

		throw new Error();

	}

}
