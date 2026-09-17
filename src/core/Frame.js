import { mat4, quat, vec3 } from 'gl-matrix';
import { quaternionSquaredDistance } from './utils/quaternion.js';
import { RAD2DEG } from './utils/constants.js';

const tempInverse = new Float32Array( 16 );
const tempMatrix = new Float32Array( 16 );
const tempQuat = new Float32Array( 4 );
const tempPos = new Float32Array( 3 );
const sharedTraversedChildren = new Set();
const sharedTraverseArray = [];
let traverseVariablesInUse = false;

/**
 * @callback FrameCallback
 * @param {Frame} frame - The frame being visited.
 * @returns {boolean} Return `true` to stop the traversal.
 */

/**
 * Base class for `Link`, `Joint`, and `Goal` representing a frame defined by a position and
 * rotation in space.
 */
export class Frame {

	constructor() {

		/**
		 * Name of the frame.
		 * @type {string}
		 */
		this.name = '';

		/**
		 * Orientation of the frame relative to its parent. If modified directly
		 * `setMatrixNeedsUpdate` must be called.
		 * @type {Float32Array}
		 */
		this.quaternion = new Float32Array( [ 0, 0, 0, 1 ] );

		/**
		 * Position of the frame relative to its parent. If modified directly
		 * `setMatrixNeedsUpdate` must be called.
		 * @type {Float32Array}
		 */
		this.position = new Float32Array( 3 );

		/**
		 * Local transform matrix composed from the position and quaternion.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.matrix = new Float32Array( 16 );
		mat4.identity( this.matrix );

		/**
		 * World transform matrix computed from the parent world matrix and the local matrix.
		 * @type {Float32Array}
		 * @readonly
		 */
		this.matrixWorld = new Float32Array( 16 );
		mat4.identity( this.matrixWorld );

		this.matrixNeedsUpdate = false;
		this.matrixWorldNeedsUpdate = false;

		/**
		 * The frame this frame is a child of.
		 * @type {Frame | null}
		 * @readonly
		 */
		this.parent = null;

		/**
		 * The frames this frame is a parent of.
		 * @type {Array<Frame>}
		 * @readonly
		 */
		this.children = [];

	}

	/**
	 * Sets the position of the frame relative to its parent.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 */
	setPosition( ...args ) {

		const position = this.position;

		if ( vec3.sqrDist( position, args ) > 1e-10 ) {

			position[ 0 ] = args[ 0 ];
			position[ 1 ] = args[ 1 ];
			position[ 2 ] = args[ 2 ];
			this.setMatrixNeedsUpdate();

		}

	}

	/**
	 * Sets the orientation of the frame relative to its parent from Euler angles in radians.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 */
	setEuler( x, y, z ) {

		quat.fromEuler( tempQuat, x * RAD2DEG, y * RAD2DEG, z * RAD2DEG );
		this.setQuaternion( ...tempQuat );

	}

	/**
	 * Sets the orientation of the frame relative to its parent.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {number} w
	 */
	setQuaternion( ...args ) {

		const quaternion = this.quaternion;
		if ( quaternionSquaredDistance( quaternion, args ) > 1e-10 ) {

			quaternion[ 0 ] = args[ 0 ];
			quaternion[ 1 ] = args[ 1 ];
			quaternion[ 2 ] = args[ 2 ];
			quaternion[ 3 ] = args[ 3 ];
			this.setMatrixNeedsUpdate();

		}

	}

	/**
	 * Sets the position of the frame in world space. The local position relative to the parent
	 * is computed automatically.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 */
	setWorldPosition( x, y, z ) {

		const parent = this.parent;

		tempPos[ 0 ] = x;
		tempPos[ 1 ] = y;
		tempPos[ 2 ] = z;

		if ( parent ) {

			parent.updateMatrixWorld();
			mat4.invert( tempInverse, parent.matrixWorld );
			vec3.transformMat4( tempPos, tempPos, tempInverse );

		}

		this.setPosition( ...tempPos );

	}

	/**
	 * Sets the orientation of the frame in world space from Euler angles in radians. The local
	 * orientation relative to the parent is computed automatically.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 */
	setWorldEuler( x, y, z ) {

		quat.fromEuler( tempQuat, x * RAD2DEG, y * RAD2DEG, z * RAD2DEG );
		this.setWorldQuaternion( ...tempQuat );

	}

	/**
	 * Sets the orientation of the frame in world space. The local orientation relative to the
	 * parent is computed automatically.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {number} w
	 */
	setWorldQuaternion( x, y, z, w ) {

		const parent = this.parent;

		tempQuat[ 0 ] = x;
		tempQuat[ 1 ] = y;
		tempQuat[ 2 ] = z;
		tempQuat[ 3 ] = w;

		if ( parent ) {

			parent.updateMatrixWorld();
			mat4.invert( tempInverse, parent.matrixWorld );
			mat4.fromQuat( tempMatrix, tempQuat );
			mat4.multiply( tempMatrix, tempInverse, tempMatrix );
			mat4.getRotation( tempQuat, tempMatrix );

		}

		this.setQuaternion( ...tempQuat );

	}

	/**
	 * Writes the position of the frame in world space into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getWorldPosition( arr ) {

		this.updateMatrixWorld();
		mat4.getTranslation( arr, this.matrixWorld );

	}

	/**
	 * Writes the orientation of the frame in world space into `target`.
	 * @param {Array<number> | Float32Array} target
	 */
	getWorldQuaternion( arr ) {

		this.updateMatrixWorld();
		mat4.getRotation( arr, this.matrixWorld );

	}

	/**
	 * Calls `callback` for every ancestor starting with the parent. Returning `true` from the
	 * callback stops the traversal.
	 * @param {FrameCallback} callback
	 */
	traverseParents( cb ) {

		// Use the shared variables if they're not already in use to avoid
		// memory allocation
		let traversedChildren;
		const originalVariablesInUse = traverseVariablesInUse;
		if ( traverseVariablesInUse ) {

			traversedChildren = new Set();

		} else {

			traversedChildren = sharedTraversedChildren;
			traversedChildren.clear();

		}

		traverseVariablesInUse = true;

		let curr = this.parent;
		while ( curr ) {

			if ( traversedChildren.has( curr ) ) {

				break;

			}

			const stop = cb( curr );
			if ( stop ) {

				break;

			}

			traversedChildren.add( curr );
			curr = curr.parent;

		}

		traverseVariablesInUse = originalVariablesInUse;
		traversedChildren.clear();

	}

	/**
	 * Calls `callback` for this frame and every descendant in breadth first order. Returning
	 * `true` from the callback stops traversal below that frame.
	 * @param {FrameCallback} callback
	 */
	traverse( cb ) {

		// Use the shared variables if they're not already in use to avoid
		// memory allocation
		const originalVariablesInUse = traverseVariablesInUse;
		let traversedChildren;
		let stack;
		if ( traverseVariablesInUse ) {

			traversedChildren = new Set();
			stack = [ this ];

		} else {

			traversedChildren = sharedTraversedChildren;
			traversedChildren.clear();

			stack = sharedTraverseArray;
			stack[ 0 ] = this;

		}

		traverseVariablesInUse = true;

		let i = 0;
		let tot = 1;
		while ( i < tot ) {

			const curr = stack[ i ];
			const stop = cb( curr );
			if ( ! stop ) {

				const children = curr.children;
				for ( let c = 0, l = children.length; c < l; c ++ ) {

					const child = children[ c ];
					if ( traversedChildren.has( child ) ) {

						continue;

					} else {

						traversedChildren.add( child );
						stack[ tot ] = child;
						tot ++;

					}

				}

			}

			i ++;

		}

		traverseVariablesInUse = originalVariablesInUse;
		traversedChildren.clear();
		stack.fill( null, 0, tot );

	}

	/**
	 * Returns the first frame in the tree, including this one, for which `callback` returns
	 * `true`, or `null` if none does.
	 * @param {FrameCallback} callback
	 * @returns {Frame | null}
	 */
	find( cb ) {

		let result = null;
		this.traverse( c => {

			if ( result ) {

				return true;

			} else if ( cb( c ) ) {

				result = c;
				return true;

			}

		} );
		return result;

	}

	/**
	 * Adds a child to this frame and sets its parent to this frame. Throws if the child already
	 * has a parent.
	 * @param {Frame} child
	 */
	addChild( child ) {

		if ( child.parent ) {

			throw new Error( 'Frame: Added child must not already have a parent.' );

		}

		if ( child === this ) {

			throw new Error( 'Frame: Frame cannot be added as a child to itself.' );

		}

		this.traverseParents( p => {

			if ( p === child ) {

				throw new Error( 'Frame: Added child is an ancestor of this Frame. Use Joint.makeClosure instead.' );

			}

		} );

		child.parent = this;
		this.children.push( child );

		child.setMatrixWorldNeedsUpdate();

	}

	/**
	 * Removes the given child from this frame. Throws if the frame is not a child of this frame.
	 * @param {Frame} child
	 */
	removeChild( child ) {

		if ( child.parent !== this ) {

			throw new Error( 'Frame: Child to be removed is not a child of this Frame.' );

		}

		const index = this.children.indexOf( child );

		this.children.splice( index, 1 );
		child.parent = null;

		child.setMatrixWorldNeedsUpdate();

	}

	/**
	 * Adds the given frame as a child while preserving its world transform.
	 * @param {Frame} child
	 */
	attachChild( child ) {

		this.updateMatrixWorld();
		child.updateMatrixWorld();

		this.addChild( child );

		mat4.invert( tempInverse, this.matrixWorld );
		mat4.multiply( child.matrix, tempInverse, child.matrixWorld );
		mat4.getTranslation( child.position, child.matrix );
		mat4.getRotation( child.quaternion, child.matrix );

	}

	/**
	 * Removes the given child while preserving its world transform.
	 * @param {Frame} child
	 */
	detachChild( child ) {

		this.updateMatrixWorld();
		child.updateMatrixWorld();

		this.removeChild( child );

		mat4.copy( child.matrix, child.matrixWorld );
		mat4.getTranslation( child.position, child.matrix );
		mat4.getRotation( child.quaternion, child.matrix );

	}

	computeMatrixWorld() {

		if ( this.parent ) {

			mat4.multiply( this.matrixWorld, this.parent.matrixWorld, this.matrix );

		} else {

			mat4.copy( this.matrixWorld, this.matrix );

		}

	}

	/**
	 * Flags this frame as needing its local and world matrices updated.
	 */
	setMatrixNeedsUpdate() {

		if ( this.matrixNeedsUpdate === false ) {

			this.matrixNeedsUpdate = true;
			this.setMatrixWorldNeedsUpdate();

		}

	}

	/**
	 * Flags this frame and all its descendants as needing their world matrices updated.
	 */
	setMatrixWorldNeedsUpdate() {

		this.traverse( c => {

			if ( c.matrixWorldNeedsUpdate ) {

				return true;

			}

			c.matrixWorldNeedsUpdate = true;
			return false;

		} );

	}

	/**
	 * Updates the local matrix if it has been flagged as needing an update.
	 */
	updateMatrix() {

		if ( this.matrixNeedsUpdate ) {

			mat4.fromRotationTranslation( this.matrix, this.quaternion, this.position );
			this.matrixNeedsUpdate = false;

		}

	}

	/**
	 * Updates the local and world matrices if they have been flagged as needing an update,
	 * updating parent matrices first as needed.
	 * @param {boolean} [updateChildren=false] - Also update the world matrices of all descendants.
	 */
	updateMatrixWorld( updateChildren = false ) {

		const { parent } = this;

		if ( this.matrixWorldNeedsUpdate ) {

			// Climb the parent chain and update parent matrices
			if ( parent && parent.matrixWorldNeedsUpdate ) {

				parent.updateMatrixWorld( false );

			}

			// Update this matrix
			this.updateMatrix();

			// Update this matrix world and dirty children
			this.computeMatrixWorld();
			this.matrixWorldNeedsUpdate = false;

		}

		// Update child matrices
		if ( updateChildren ) {

			this.traverse( c => {

				if ( this !== c ) {

					c.updateMatrixWorld( false );

				}

			} );

		}

	}

}
