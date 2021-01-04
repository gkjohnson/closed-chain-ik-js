import { mat4, quat } from 'gl-matrix';
import { Frame } from './Frame.js';
import { getClosestEulerRepresentation, toSmallestEulerValueDistance } from './utils/euler.js';
import { getEuler, getMatrixDifference } from './utils/glmatrix.js';
import { RAD2DEG, DEG2RAD } from './utils/constants.js';

// degrees of freedom axes
export const DOF = {
	X: 0,
	Y: 1,
	Z: 2,
	EX: 3,
	EY: 4,
	EZ: 5,
};

export const DOF_NAMES = Object.entries( DOF ).sort( ( a, b ) => a[ 1 ] - b[ 1 ] ).map( e => e[ 0 ] );

const tempInverse = new Float32Array( 16 );
const tempMatrix = new Float32Array( 16 );
const tempQuat = new Float32Array( 4 );
const tempEuler = new Float32Array( 3 );
const tempValueEuler = new Float32Array( 3 );
const quatEuler = new Float32Array( 3 );
const tempDoFValues = new Float32Array( 6 );

// generate a matrix from a set of degrees of freedom
function dofToMatrix( out, dof ) {

	quat.fromEuler( tempQuat, dof[ DOF.EX ] * RAD2DEG, dof[ DOF.EY ] * RAD2DEG, dof[ DOF.EZ ] * RAD2DEG );
	mat4.fromRotationTranslation( out, tempQuat, dof );

}

export class Joint extends Frame {

	constructor() {

		super();
		this.isJoint = true;

		this.child = null;
		this.isClosure = false;

		this.trackJointWrap = false;
		this.rotationDoFCount = 0;
		this.translationDoFCount = 0;

		// TODO: should we make DoF Flags a bit mask flag?
		this.dof = [];
		this.dofFlags = new Uint8Array( 6 );
		this.dofValues = new Float32Array( 6 );
		this.dofTarget = new Float32Array( 6 );
		this.dofRestPose = new Float32Array( 6 );

		this.minDoFLimit = new Float32Array( 6 ).fill( - Infinity );
		this.maxDoFLimit = new Float32Array( 6 ).fill( Infinity );

		this.targetSet = false;
		this.restPoseSet = false;

		this.matrixDoFNeedsUpdate = false;
		this.matrixDoF = new Float32Array( 16 );
		mat4.identity( this.matrixDoF );

		this.cachedIdentityDoFMatrixWorld = new Float32Array( 16 );
		mat4.identity( this.cachedIdentityDoFMatrixWorld );

		// TODO: Consider affording control over rotation order
		// TODO: Create pre built joint types

	}

	// private helpers
	_getQuaternion( target, outQuat ) {

		quat.fromEuler( outQuat, target[ DOF.EX ], target[ DOF.EY ], target[ DOF.EZ ] );

	}

	_getEuler( target, outEuler ) {

		outEuler[ 0 ] = target[ DOF.EX ];
		outEuler[ 1 ] = target[ DOF.EY ];
		outEuler[ 2 ] = target[ DOF.EZ ];

	}

	_getPosition( target, outPos ) {

		outPos[ 0 ] = target[ DOF.X ];
		outPos[ 1 ] = target[ DOF.Y ];
		outPos[ 2 ] = target[ DOF.Z ];

	}

	_setValue( target, dof, value ) {

		if ( target === this.minDoFLimit || target == this.maxDoFLimit ) {

			throw new Error( 'Joint: Cannot set minDoFLimit or maxDoFLimit with _setValue.' );

		}

		if ( dof < 0 || dof > 6 || typeof dof !== 'number' ) {

			throw new Error( 'Joint: Invalid DoF.' );

		}

		if ( ! this.dofFlags[ dof ] ) {

			return false;

		}

		const minVal = this.minDoFLimit[ dof ];
		const maxVal = this.maxDoFLimit[ dof ];

		if ( value < minVal ) {

			value = minVal;

		}

		if ( value > maxVal ) {

			value = maxVal;

		}

		target[ dof ] = value;
		return value === maxVal || value === minVal;

	}

	_setValues( target, values ) {

		const dof = this.dof;
		for ( let i = 0, l = values.length; i < l; i ++ ) {

			this._setValue( target, dof[ i ], values[ i ] );

		}

	}

	// TODO: these functions are unused
	_setViaFullPosition( target, values ) {

		const dofFlags = this.dofFlags;
		for ( let i = 0; i < 3; i ++ ) {

			target[ i ] = dofFlags[ i ] * values[ i ];

		}

	}

	_setViaFullEuler( target, values ) {

		const dofFlags = this.dofFlags;
		for ( let i = 3; i < 6; i ++ ) {

			target[ i ] = dofFlags[ i ] * values[ i - 3 ];

		}

		this.tryMinimizeEulerAngles();

	}

	_setViaQuaternion( target, values ) {

		getEuler( quatEuler, values );
		quatEuler[ 0 ] *= DEG2RAD;
		quatEuler[ 1 ] *= DEG2RAD;
		quatEuler[ 2 ] *= DEG2RAD;

		if ( this.trackJointWrap ) {

			// if we're tracking joint wrap then set this to be as close as possible to
			// the current dof settings.
			// TODO: How should restPose work here? Should it always be the shortest distance?
			const dofValues = this.dofValues;
			tempEuler[ 0 ] = dofValues[ DOF.EX ];
			tempEuler[ 1 ] = dofValues[ DOF.EY ];
			tempEuler[ 2 ] = dofValues[ DOF.EZ ];
			getClosestEulerRepresentation( quatEuler, tempEuler, quatEuler );

		}

		this._setViaFullEuler( target, quatEuler );

	}

	// Set the degrees of freedom
	clearDoF() {

		this.setDoF();

	}

	setDoF( ...args ) {

		args.forEach( ( dof, i ) => {

			if ( dof < 0 || dof >= 6 ) {

				throw new Error( 'Joint: Invalid degree of freedom enum ' + dof + '.' );

			}

			if ( args.includes( dof, i + 1 ) ) {

				throw new Error( 'Joint: Duplicate degree of freedom ' + DOF_NAMES[ dof ] + 'specified.' );

			}

			if ( i !== 0 && args[ i - 1 ] > dof ) {

				throw new Error( 'Joint: Joints degrees of freedom must be specified in position then rotation, XYZ order' );

			}

		} );

		this.dof = args;
		this.dofValues.fill( 0 );
		this.dofTarget.fill( 0 );
		this.dofRestPose.fill( 0 );

		this.minDoFLimit.fill( - Infinity );
		this.maxDoFLimit.fill( Infinity );
		this.setMatrixDoFNeedsUpdate();

		for ( let i = 0; i < 6; i ++ ) {

			this.dofFlags[ i ] = Number( args.includes( i ) );

		}

		this.rotationDoFCount =
			this.dofFlags[ DOF.EX ] +
			this.dofFlags[ DOF.EY ] +
			this.dofFlags[ DOF.EZ ];
		this.translationDoFCount =
			this.dofFlags[ DOF.X ] +
			this.dofFlags[ DOF.Y ] +
			this.dofFlags[ DOF.Z ];

	}

	// Get and set the values of the different degrees of freedom
	setDoFValues( ...values ) {

		this.setMatrixDoFNeedsUpdate();
		this._setValues( this.dofValues, values );

	}

	setDoFValue( dof, value ) {

		this.setMatrixDoFNeedsUpdate();
		return this._setValue( this.dofValues, dof, value );

	}

	getDoFValue( dof ) {

		return this.dofValues[ dof ];

	}

	getDoFQuaternion( outQuat ) {

		this._getQuaternion( this.dofValues, outQuat );

	}

	getDoFEuler( outEuler ) {

		this._getEuler( this.dofValues, outEuler );

	}

	getDoFPosition( outPos ) {

		this._getPosition( this.dofValues, outPos );

	}

	// Get and set the restPose values of the different degrees of freedom
	setRestPoseValues( ...values ) {

		this._setValues( this.dofRestPose, values );

	}

	setRestPoseValue( dof, value ) {

		return this._setValue( this.dofRestPose, dof, value );

	}

	getRestPoseValue( dof ) {

		return this.dofRestPose[ dof ];

	}

	getRestPoseQuaternion( outQuat ) {

		this._getQuaternion( this.dofRestPose, outQuat );

	}

	getRestPoseEuler( outEuler ) {

		this._getEuler( this.dofRestPose, outEuler );

	}

	getRestPosePosition( outPos ) {

		this._getPosition( this.dofRestPose, outPos );

	}

	// Get and set the restPose values of the different degrees of freedom
	setTargetValues( ...values ) {

		this._setValues( this.dofTarget, values );

	}

	setTargetValue( dof, value ) {

		this._setValue( this.dofTarget, dof, value );

	}

	getTargetValue( dof ) {

		return this.dofTarget[ dof ];

	}

	getTargetQuaternion( outQuat ) {

		this._getQuaternion( this.dofTarget, outQuat );

	}

	getTargetEuler( outEuler ) {

		this._getEuler( this.dofTarget, outEuler );

	}

	getTargetPosition( outPos ) {

		this._getPosition( this.dofTarget, outPos );

	}

	// Joint Limits
	setMinLimits( ...values ) {

		const { dof } = this;
		for ( const i in values ) {

			const d = dof[ i ];
			this.setMinLimit( d, values[ i ] );

		}

	}

	setMinLimit( dof, value ) {

		this.minDoFLimit[ dof ] = value;
		this.setDoFValue( dof, this.dofValues[ dof ] );

	}

	getMinLimit( dof ) {

		return this.minDoFLimit[ dof ];

	}

	setMaxLimits( ...values ) {

		const { dof } = this;
		for ( const i in values ) {

			const d = dof[ i ];
			this.setMaxLimit( d, values[ i ] );

		}

	}

	setMaxLimit( dof, value ) {

		this.maxDoFLimit[ dof ] = value;
		this.setDoFValue( dof, this.dofValues[ dof ] );

	}

	getMaxLimit( dof ) {

		return this.maxDoFLimit[ dof ];

	}

	// Returns the error between this joint and the next link if this is a closure.
	// TODO: remove this and put it in solver
	getClosureError( outPos, outQuat ) {

		if ( ! this.isClosure ) {

			throw new Error( 'Joint: Cannot get closure error on non closure Joint.' );

		}

		this.updateMatrixWorld();
		this.child.updateMatrixWorld();

		// error from this position to child
		getMatrixDifference( this.matrixWorld, this.child.matrixWorld, outPos, outQuat );

	}

	// Update matrix overrides
	// TODO: it might be best if we skip this and try to characterize joint error with quats in
	// the error vector
	tryMinimizeEulerAngles() {

		const {
			trackJointWrap,
			rotationDoFCount,
			dofRestPose,
			dofTarget,
			dofValues,
		} = this;

		if ( ! trackJointWrap ) {

			if ( rotationDoFCount < 3 ) {

				for ( let i = DOF.EX; i <= DOF.EZ; i ++ ) {

					dofTarget[ i ] = toSmallestEulerValueDistance( dofValues[ i ], dofTarget[ i ] );
					dofRestPose[ i ] = toSmallestEulerValueDistance( dofValues[ i ], dofRestPose[ i ] );

				}

			} else {

				tempValueEuler[ 0 ] = dofValues[ DOF.EX ];
				tempValueEuler[ 1 ] = dofValues[ DOF.EY ];
				tempValueEuler[ 2 ] = dofValues[ DOF.EZ ];

				// update target
				tempEuler[ 0 ] = dofTarget[ DOF.EX ];
				tempEuler[ 1 ] = dofTarget[ DOF.EY ];
				tempEuler[ 2 ] = dofTarget[ DOF.EZ ];

				getClosestEulerRepresentation( tempEuler, tempValueEuler, tempEuler );

				dofTarget[ DOF.EX ] = tempEuler[ 0 ];
				dofTarget[ DOF.EY ] = tempEuler[ 1 ];
				dofTarget[ DOF.EZ ] = tempEuler[ 2 ];

				// update restPose
				tempEuler[ 0 ] = dofRestPose[ DOF.EX ];
				tempEuler[ 1 ] = dofRestPose[ DOF.EY ];
				tempEuler[ 2 ] = dofRestPose[ DOF.EZ ];

				getClosestEulerRepresentation( tempEuler, tempValueEuler, tempEuler );

				dofRestPose[ DOF.EX ] = tempEuler[ 0 ];
				dofRestPose[ DOF.EY ] = tempEuler[ 1 ];
				dofRestPose[ DOF.EZ ] = tempEuler[ 2 ];

			}

		}

	}

	getDeltaWorldMatrix( dof, delta, outMatrix ) {

		const {
			dofValues,
			minDoFLimit,
			maxDoFLimit,
			cachedIdentityDoFMatrixWorld,
		} = this;

		this.updateMatrixWorld();

		// copy out set of dof values
		tempDoFValues.set( dofValues );

		// get the state
		const min = minDoFLimit[ dof ];
		const max = maxDoFLimit[ dof ];
		const currVal = tempDoFValues[ dof ];

		// check what our slack is
		const minSlack = currVal - min;
		const maxSlack = max - currVal;

		// If we're constrained by either limit then move in the other direction then
		// use the direction with the most slack.
		let newVal = currVal + delta;
		const isMaxConstrained = delta > 0 && newVal > max;
		const isMinConstrained = delta < 0 && newVal < min;
		const doInvert = ( isMaxConstrained && minSlack > maxSlack ) || ( isMinConstrained && maxSlack > minSlack );
		if ( doInvert ) {

			newVal = currVal - delta;

		}

		// update our dof array and compute the matrix
		tempDoFValues[ dof ] = newVal;

		dofToMatrix( tempMatrix, tempDoFValues );

		mat4.multiply( outMatrix, cachedIdentityDoFMatrixWorld, tempMatrix );

		return doInvert;

	}

	// matrix updates
	setMatrixDoFNeedsUpdate() {

		if ( this.matrixDoFNeedsUpdate === false ) {

			this.matrixDoFNeedsUpdate = true;
			this.setMatrixWorldNeedsUpdate();

		}

	}

	updateDoFMatrix() {

		if ( this.matrixDoFNeedsUpdate ) {

			dofToMatrix( this.matrixDoF, this.dofValues );
			this.matrixDoFNeedsUpdate = false;


		}

	}

	computeMatrixWorld() {

		const {
			parent,
			matrixWorld,
			matrix,
			matrixDoF,
			cachedIdentityDoFMatrixWorld
		} = this;

		this.updateDoFMatrix();

		mat4.multiply( matrixWorld, matrix, matrixDoF );
		if ( parent ) {

			mat4.multiply( matrixWorld, parent.matrixWorld, matrixWorld );
			mat4.multiply( cachedIdentityDoFMatrixWorld, parent.matrixWorld, matrix );

		} else {

			mat4.copy( cachedIdentityDoFMatrixWorld, matrix );

		}



	}

	// Add child overrides
	makeClosure( child ) {

		if ( ! child.isLink || this.child || child.parent === this ) {

			throw new Error( 'Joint: Given child cannot be used to make closure.' );

		} else {

			// don't store the closure child in the children array to avoid
			// implicit traversal.
			this.child = child;
			this.isClosure = true;
			child.closureJoints.push( this );

		}

	}

	addChild( child ) {

		if ( ! child.isLink || this.child || child.parent === this ) {

			throw new Error( 'Joint: Given child cannot be added to Joint.' );

		} else {

			super.addChild( child );
			this.child = child;
			this.isClosure = false;

		}

	}

	removeChild( child ) {

		if ( this.isClosure ) {

			if ( this.child !== child ) {

				throw new Error( 'Frame: Child to be removed is not a child of this Joint.' );

			} else {

				this.child = null;
				this.isClosure = false;

				const index = child.closureJoints.indexOf( this );
				child.closureJoints.splice( index, 1 );

			}

		} else {

			super.removeChild( child );

		}

	}

	attachChild( child ) {

		super.attachChild( child );

		// remove the dof rotation afterward
		mat4.invert( tempInverse, this.matrixDoF );
		mat4.multiply( child.matrix, tempInverse, child.matrix );
		mat4.getTranslation( child.position, child.matrix );
		mat4.getRotation( child.quaternion, child.matrix );

	}

	detachChild( child ) {

		super.detachChild( child );

		// remove the dof rotation afterward
		mat4.invert( tempInverse, this.matrixDoF );
		mat4.multiply( child.matrix, tempInverse, child.matrix );
		mat4.getTranslation( child.position, child.matrix );
		mat4.getRotation( child.quaternion, child.matrix );

	}

}
