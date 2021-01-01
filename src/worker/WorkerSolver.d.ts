import { SOLVE_STATUS } from '../core/ChainSolver';
import { Frame } from '../core/Frame';
import { Joint } from '../core/Joint';

export class WorkerSolver {

	running : Boolean;
	status : Array<SOLVE_STATUS>;

	constructor( roots : Array<Frame> );

	updateStructure() : void;
	updateSolverSettings( settings : Object ) : void;
	updateFrameState( ...joints : Array<Joint> ) : void;
	solve() : void;
	stop() : void;
	dispose() : void;

}
