import { Frame } from './Frame';
import { SOLVE_STATUS } from './ChainSolver';

export class Solver {

	useSVD : Boolean;

	maxIterations : Number;
	stallThreshold : Number;
	dampingFactor : Number;
	divergeThreshold : Number;
	restPoseFactor : Number;

	translationConvergeThreshold : Number;
	rotationConvergeThreshold : Number;

	translationFactor : Number;
	rotationFactor : Number;

	translationStep : Number;
	rotationStep : Number;

	translationErrorClamp : Number;
	rotationErrorClamp : Number;

	roots : Array<Frame>;

	constructor( roots : Array<Frame> );
	updateStructure() : void;
	solve() : Array<SOLVE_STATUS>;

}
