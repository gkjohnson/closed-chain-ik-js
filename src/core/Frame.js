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

export class Frame {

	constructor() {

		this.name = '';

		this.quaternion = new Float32Array( [ 0, 0, 0, 1 ] );
		this.position = new Float32Array( 3 );

		this.matrix = new Float32Array( 16 );
		mat4.identity( this.matrix );

		this.matrixWorld = new Float32Array( 16 );
		mat4.identity( this.matrixWorld );

		this.matrixNeedsUpdate = false;
		this.matrixWorldNeedsUpdate = false;

		this.parent = null;
		this.children = [];

	}

	setPosition( ...args ) {

		const position = this.position;

		if ( vec3.sqrDist( position, args ) > 1e-10 ) {

			position[ 0 ] = args[ 0 ];
			position[ 1 ] = args[ 1 ];
			position[ 2 ] = args[ 2 ];
			this.setMatrixNeedsUpdate();

		}

	}

	setEuler( x, y, z ) {

		quat.fromEuler( tempQuat, x * RAD2DEG, y * RAD2DEG, z * RAD2DEG );
		this.setQuaternion( ...tempQuat );

	}

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

	setWorldEuler( x, y, z ) {

		quat.fromEuler( tempQuat, x * RAD2DEG, y * RAD2DEG, z * RAD2DEG );
		this.setWorldQuaternion( ...tempQuat );

	}

	setWorldQuaternion( x, y, z, w ) {

		const parent = this;

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

	getWorldPosition( arr ) {

		this.updateMatrixWorld();
		mat4.getTranslation( arr, this.matrixWorld );

	}

	getWorldQuaternion( arr ) {

		this.updateMatrixWorld();
		mat4.getRotation( arr, this.matrixWorld );

	}

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

				return;

			}

			traversedChildren.add( curr );
			curr = curr.parent;

		}

		traverseVariablesInUse = originalVariablesInUse;
		traversedChildren.clear();

	}

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
		stack.fill( null );

	}

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

	removeChild( child ) {

		if ( child.parent !== this ) {

			throw new Error( 'Frame: Child to be removed is not a child of this Frame.' );

		}

		const index = this.children.indexOf( child );

		this.children.splice( index, 1 );
		child.parent = null;

		child.setMatrixWorldNeedsUpdate();

	}

	attachChild( child ) {

		this.updateMatrixWorld();
		child.updateMatrixWorld();

		this.addChild( child );

		mat4.invert( tempInverse, this.matrixWorld );
		mat4.multiply( child.matrix, tempInverse, child.matrixWorld );
		mat4.getTranslation( child.position, child.matrix );
		mat4.getRotation( child.quaternion, child.matrix );

	}

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

	setMatrixNeedsUpdate() {

		if ( this.matrixNeedsUpdate === false ) {

			this.matrixNeedsUpdate = true;
			this.setMatrixWorldNeedsUpdate();

		}

	}

	setMatrixWorldNeedsUpdate() {

		this.traverse( c => {

			if ( c.matrixWorldNeedsUpdate ) {

				return true;

			}

			c.matrixWorldNeedsUpdate = true;
			return false;

		} );

	}

	updateMatrix() {

		if ( this.matrixNeedsUpdate ) {

			mat4.fromRotationTranslation( this.matrix, this.quaternion, this.position );
			this.matrixNeedsUpdate = false;

		}

	}

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
