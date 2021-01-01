import { Joint, DOF } from './Joint';

export class Goal extends Joint {

	isGoal : Boolean;

	setGoalDoF( ...args : Array<DOF> ) : void;
	setFreeDoF( ...args : Array<DOF> ) : void;

}
