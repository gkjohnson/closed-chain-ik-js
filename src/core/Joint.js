/** @import { Link } from './Link.js' */
import { mat4, quat } from 'gl-matrix';
import { Frame } from './Frame.js';
import { getClosestEulerRepresentation, toSmallestEulerValueDistance } from './utils/euler.js';
import { getEuler, getMatrixDifference } from './utils/glmatrix.js';
import { RAD2DEG, DEG2RAD } from './utils/constants.js';

/**
 * Degrees of freedom that can be assigned to a joint.
 *
 * ```js
 * // Translation along an axis
 * DOF.X, DOF.Y, DOF.Z
 *
 * // Euler rotation about an axis
 * DOF.EX, DOF.EY, DOF.EZ
 * ```
 * @type {Object<string, number>}
 */
export const DOF = {
	X: 0,
	Y: 1,
	Z: 2,
	EX: 3,
	EY: 4,
	EZ: 5,
};

/**
 * Names of the degrees of freedom indexed by `DOF` value.
 * @type {Array<string>}
 */
export const DOF_NAMES = Object.entries( DOF ).sort( ( a, b ) => a[ 1 ] - b[ 1 ] ).map( e => e[ 0 ] );

const tempInverse = new Float32Array( 16 );
const tempQuat = new Float32Array( 4 );
const tempEuler = new Float32Array( 3 );
const tempValueEuler = new Float32Array( 3 );
const quatEuler = new Float32Array( 3 );

// generate a matrix from a set of degrees of freedom
function dofToMatrix( out, dof ) {

	quat.fromEuler( tempQuat, dof[ DOF.EX ] * RAD2DEG, dof[ DOF.EY ] * RAD2DEG, dof[ DOF.EZ ] * RAD2DEG );
	mat4.fromRotationTranslation( out, tempQuat, dof );

}

/**
 * A frame representing a kinematic joint with any combination of degrees of freedom. Each
 * degree of freedom is an offset applied on top of the frame transform. Only links may be
 * added as children and a joint may only have a single child.
 * @extends Frame
 */
export class Joint extends Frame {

	constructor() {

		super();
		this.isJoint = true;

		/**
		 * The child link of the joint, whether added directly or through `makeClosure`.
		 * @type {Link | null}
		 * @readonly
		 */
		this.child = null;

		/**
		 * Whether the child relationship is a closure made with `makeClosure`.
		 * @type {boolean}
		 * @readonly
		 */
		this.isClosure = false;

		this.trackJointWrap = false;

		/**
		 * Number of rotation degrees of freedom set on the joint.
		 * @type {number}
		 * @readonly
		 */
		this.rotationDoFCount = 0;

		/**
		 * Number of translation degrees of freedom set on the joint.
		 * @type {number}
		 * @readonly
		 */
		this.translationDoFCount = 0;

		// TODO: should we make DoF Flags a bit mask flag?
		/**
		 * The degrees of freedom set on the joint in `DOF` order.
		 * @type {Array<number>}
		 * @readonly
		 */
		this.dof = [];

		/**
		 * Flags indexed by `DOF` value that are `1` when the degree of freedom is set.
		 * @type {Uint8Array}
		 * @readonly
		 */
		this.dofFlags = new Uint8Array( 6 );

		/**
		 * Current values of each degree of freedom indexed by `DOF` value. If modified directly
		 * `setMatrixDoFNeedsUpdate` must be called.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.dofValues = new Float32Array( 6 );

		/**
		 * Target value of each degree of freedom indexed by `DOF` value. The solver moves the
		 * joint toward these when `targetSet` is true.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.dofTarget = new Float32Array( 6 );

		/**
		 * Rest pose of each degree of freedom indexed by `DOF` value. The solver moves the joint
		 * toward these when `restPoseSet` is true and it does not compromise the other goals.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.dofRestPose = new Float32Array( 6 );

		/**
		 * Minimum limit of each degree of freedom indexed by `DOF` value.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.minDoFLimit = new Float32Array( 6 ).fill( - Infinity );

		/**
		 * Maximum limit of each degree of freedom indexed by `DOF` value.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.maxDoFLimit = new Float32Array( 6 ).fill( Infinity );

		/**
		 * Whether the solver should move the joint toward `dofTarget`.
		 * @type {boolean}
		 * @default false
		 */
		this.targetSet = false;

		/**
		 * Whether the solver should move the joint toward `dofRestPose`.
		 * @type {boolean}
		 * @default false
		 */
		this.restPoseSet = false;

		this.matrixDoFNeedsUpdate = false;

		/**
		 * Transform offset produced by the current degree of freedom values.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.matrixDoF = new Float32Array( 16 );
		mat4.identity( this.matrixDoF );

		// this is the position and orientation of the joint before offsets are applied
		this.cachedIdentityDoFMatrixWorld = new Float32Array( 16 );
		mat4.identity( this.cachedIdentityDoFMatrixWorld );

		// TODO: Consider affording control over rotation order
		// TODO: Create pre built joint types

	}

	// private helpers
	_getQuaternion( target, outQuat ) {

		quat.fromEuler( outQuat, target[ DOF.EX ] * RAD2DEG, target[ DOF.EY ] * RAD2DEG, target[ DOF.EZ ] * RAD2DEG );

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

	/**
	 * Removes all degrees of freedom from the joint.
	 */
	clearDoF() {

		this.setDoF();

	}

	/**
	 * Sets the degrees of freedom of the joint and resets all related values and limits.
	 * Arguments must be in `X`, `Y`, `Z`, `EX`, `EY`, `EZ` order without duplicates.
	 * @param {...number} dof - The `DOF` fields to set.
	 */
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

	/**
	 * Sets the value of every degree of freedom in `dof` order, clamped to the joint limits.
	 * @param {...number} values - One value per degree of freedom.
	 */
	setDoFValues( ...values ) {

		this.setMatrixDoFNeedsUpdate();
		this._setValues( this.dofValues, values );

	}

	/**
	 * Sets the value of a degree of freedom, clamped to the joint limits.
	 * @param {number} dof - The `DOF` field to set.
	 * @param {number} value
	 * @returns {boolean} Whether the value was clamped to a limit.
	 */
	setDoFValue( dof, value ) {

		this.setMatrixDoFNeedsUpdate();
		return this._setValue( this.dofValues, dof, value );

	}

	/**
	 * Returns the value of a degree of freedom.
	 * @param {number} dof - The `DOF` field to get.
	 * @returns {number}
	 */
	getDoFValue( dof ) {

		return this.dofValues[ dof ];

	}

	/**
	 * Writes the rotation degree of freedom values as a quaternion into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getDoFQuaternion( outQuat ) {

		this._getQuaternion( this.dofValues, outQuat );

	}

	/**
	 * Writes the rotation degree of freedom values as Euler angles into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getDoFEuler( outEuler ) {

		this._getEuler( this.dofValues, outEuler );

	}

	/**
	 * Writes the translation degree of freedom values into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getDoFPosition( outPos ) {

		this._getPosition( this.dofValues, outPos );

	}

	/**
	 * Sets the rest pose of every degree of freedom in `dof` order, clamped to the joint limits.
	 * @param {...number} values - One value per degree of freedom.
	 */
	setRestPoseValues( ...values ) {

		this._setValues( this.dofRestPose, values );

	}

	/**
	 * Sets the rest pose of a degree of freedom, clamped to the joint limits.
	 * @param {number} dof - The `DOF` field to set.
	 * @param {number} value
	 * @returns {boolean} Whether the value was clamped to a limit.
	 */
	setRestPoseValue( dof, value ) {

		return this._setValue( this.dofRestPose, dof, value );

	}

	/**
	 * Returns the rest pose of a degree of freedom.
	 * @param {number} dof - The `DOF` field to get.
	 * @returns {number}
	 */
	getRestPoseValue( dof ) {

		return this.dofRestPose[ dof ];

	}

	/**
	 * Writes the rotation rest pose as a quaternion into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getRestPoseQuaternion( outQuat ) {

		this._getQuaternion( this.dofRestPose, outQuat );

	}

	/**
	 * Writes the rotation rest pose as Euler angles into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getRestPoseEuler( outEuler ) {

		this._getEuler( this.dofRestPose, outEuler );

	}

	/**
	 * Writes the translation rest pose into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getRestPosePosition( outPos ) {

		this._getPosition( this.dofRestPose, outPos );

	}

	/**
	 * Sets the target of every degree of freedom in `dof` order, clamped to the joint limits.
	 * @param {...number} values - One value per degree of freedom.
	 */
	setTargetValues( ...values ) {

		this._setValues( this.dofTarget, values );

	}

	/**
	 * Sets the target of a degree of freedom, clamped to the joint limits.
	 * @param {number} dof - The `DOF` field to set.
	 * @param {number} value
	 */
	setTargetValue( dof, value ) {

		this._setValue( this.dofTarget, dof, value );

	}

	/**
	 * Returns the target of a degree of freedom.
	 * @param {number} dof - The `DOF` field to get.
	 * @returns {number}
	 */
	getTargetValue( dof ) {

		return this.dofTarget[ dof ];

	}

	/**
	 * Writes the rotation target as a quaternion into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getTargetQuaternion( outQuat ) {

		this._getQuaternion( this.dofTarget, outQuat );

	}

	/**
	 * Writes the rotation target as Euler angles into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getTargetEuler( outEuler ) {

		this._getEuler( this.dofTarget, outEuler );

	}

	/**
	 * Writes the translation target into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getTargetPosition( outPos ) {

		this._getPosition( this.dofTarget, outPos );

	}

	/**
	 * Sets the minimum limit of every degree of freedom in `dof` order.
	 * @param {...number} values - One value per degree of freedom.
	 */
	setMinLimits( ...values ) {

		const { dof } = this;
		for ( const i in values ) {

			const d = dof[ i ];
			this.setMinLimit( d, values[ i ] );

		}

	}

	/**
	 * Sets the minimum limit of a degree of freedom and clamps the current value to it.
	 * @param {number} dof - The `DOF` field to set.
	 * @param {number} value
	 */
	setMinLimit( dof, value ) {

		this.minDoFLimit[ dof ] = value;
		this.setDoFValue( dof, this.dofValues[ dof ] );

	}

	/**
	 * Returns the minimum limit of a degree of freedom.
	 * @param {number} dof - The `DOF` field to get.
	 * @returns {number}
	 */
	getMinLimit( dof ) {

		return this.minDoFLimit[ dof ];

	}

	/**
	 * Sets the maximum limit of every degree of freedom in `dof` order.
	 * @param {...number} values - One value per degree of freedom.
	 */
	setMaxLimits( ...values ) {

		const { dof } = this;
		for ( const i in values ) {

			const d = dof[ i ];
			this.setMaxLimit( d, values[ i ] );

		}

	}

	/**
	 * Sets the maximum limit of a degree of freedom and clamps the current value to it.
	 * @param {number} dof - The `DOF` field to set.
	 * @param {number} value
	 */
	setMaxLimit( dof, value ) {

		this.maxDoFLimit[ dof ] = value;
		this.setDoFValue( dof, this.dofValues[ dof ] );

	}

	/**
	 * Returns the maximum limit of a degree of freedom.
	 * @param {number} dof - The `DOF` field to get.
	 * @returns {number}
	 */
	getMaxLimit( dof ) {

		return this.maxDoFLimit[ dof ];

	}

	// Returns the error between this joint and the next link if this is a closure.
	// TODO: remove this and put it in solver
	getClosureError( outPos, outRotVec ) {

		if ( ! this.isClosure ) {

			throw new Error( 'Joint: Cannot get closure error on non closure Joint.' );

		}

		this.updateMatrixWorld();
		this.child.updateMatrixWorld();

		// error from this position to child
		getMatrixDifference( this.matrixWorld, this.child.matrixWorld, outPos, outRotVec );

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

	/**
	 * Flags the joint as needing its degree of freedom matrix and world matrix updated.
	 */
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

	/**
	 * Connects the given link to this joint as a closure. The link is not added to `children`
	 * and keeps its own parent, but is set as `child` and the joint is appended to the link's
	 * `closureJoints`. The solver constrains all six axes between the joint and the link to
	 * keep the closure closed.
	 * @param {Link} child
	 */
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

	/**
	 * Adds a link as the child of this joint. Throws if the child is not a link or the joint
	 * already has a child.
	 * @param {Link} child
	 */
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
