import { Frame } from './Frame';
import { Link } from './Link';

export const enum DOF { X, Y, Z, EX, EY, EZ }

export const DOF_NAMES : Array<String>;

export class Joint extends Frame {

	isJoint : Boolean;

	child : Link;
	isClosure : Boolean;

	rotationDoFCount : Number;
	translationDoFCount : Number;

	dof : Array<Number>;
	dofFlags : Uint8Array;
	dofValue : Float32Array;
	dofTarget : Float32Array;
	dofRestPose : Float32Array;

	minDoFLimit : Float32Array;
	maxDoFLimit : Float32Array;

	targetSet : Boolean;
	restPoseSet : Boolean;

	matrixDoF : Float32Array;

	clearDoF() : void;
	setDoF( ...args : Array<DOF> ) : void;

	setDoFValues( ...args : Array<Number> ) : void;
	setDoFValue( dof : DOF, value : Number ) : Boolean;
	setDoFQuaternion( x : Number, y : Number, z : Number, w : Number ) : void;
	getDoFValue( dof : DOF ) : Number;
	getDoFQuaternion( quat : Array<Number> ) : void;
	getDoFEuler( euler : Array<Number> ) : void;
	getDoFPosition( position : Array<Number> ) : void;

	setRestPoseValues( ...args : Array<Number> ) : void;
	setRestPoseValue( dof : DOF, value : Number ) : Boolean;
	getRestPoseValue( dof : DOF ) : Number;
	getRestPoseQuaternion( quat : Array<Number> ) : void;
	getRestPoseEuler( euler : Array<Number> ) : void;
	getRestPosePosition( position : Array<Number> ) : void;

	setTargetValues( ...args : Array<Number> ) : void;
	setTargetValue( dof : DOF, value : Number ) : Boolean;
	getTargetValue( dof : DOF ) : Number;
	getTargetQuaternion( quat : Array<Number> ) : void;
	getTargetEuler( euler : Array<Number> ) : void;
	getTargetPosition( position : Array<Number> ) : void;

	setMinLimits( ...args : Array<Number> ) : void;
	setMinLimt( dof : DOF, value : Number ) : void;
	getMinLimit( dof : DOF ) : Number;

	setMaxLimits( ...args : Array<Number> ) : void;
	setMaxLimt( dof : DOF, value : Number ) : void;
	getMaxLimit( dof : DOF ) : Number;

	setMatrixDoFNeedsUpdate() : void;
	updateDoFMatrix() : void;

	makeClosure( child : Link ) : void;
	addChild( child : Link ) : void;
	removeChild( child : Link ) : void;
	attachChild( child : Link ) : void;
	detachChild( child : Link ) : void;

}
