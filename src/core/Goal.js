import { Joint } from './Joint.js';

export class Goal extends Joint {

	constructor( ...args ) {

		super( ...args );
		this.isGoal = true;

	}

}
