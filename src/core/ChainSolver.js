import { vec3, mat4 } from 'gl-matrix';
import { accumulateClosureError, accumulateTargetError } from './utils/solver.js';
import { mat } from './utils/matrix.js';
import { AXES } from './utils/constants.js';

// temp reusable variables
const tempRotVec = new Float64Array( 3 );
const tempPos = new Float64Array( 3 );
const jointWorldPos = new Float64Array( 3 );
const targetWorldPos = new Float64Array( 3 );
const axisWorld = new Float64Array( 3 );
const toTarget = new Float64Array( 3 );

const tempAxisQuat = new Float64Array( 4 );
const targetJoints = [];
const freeJoints = [];
const errorResultInfo = {
	rowCount: 0,
	isConverged: false,
	totalError: 0,
};
const dofResultInfo = {
	errorRows: 0,
	freeDoF: 0,
	totalError: 0,
};

export const SOLVE_STATUS = {

	CONVERGED: 0,
	STALLED: 1,
	DIVERGED: 2,
	TIMEOUT: 3,

};

export const SOLVE_STATUS_NAMES = Object.entries( SOLVE_STATUS ).sort( ( a, b ) => a[ 1 ] - b[ 1 ] ).map( el => el[ 0 ] );

export class ChainSolver {

	constructor( chain ) {

		this.chain = Array.from( chain );

		// list of targets we're trying to minimize in the chain
		this.targets = null;

		// map of joint -> closures that the given joint affects
		this.affectedClosures = null;

		// map of joint -> closure children that the given joint affects
		this.affectedConnectedClosures = null;

		// map of joint -> that stores the amount of DoF that are locked after
		// hitting a joint limit.
		// Undefined or 0 if none are locked
		this.lockedJointDoFCount = null;

		// map of joint -> list of locked DoF
		this.lockedJointDoF = null;

		// map of joint -> previous joint angles for resetting joint angles on
		// divergence check.
		this.prevDoFValues = null;

		// options -- these are set by the containing Solver.
		this.maxIterations = - 1;

		this.matrixPool = null;

		this.useSVD = false;

		this.translationConvergeThreshold = - 1;
		this.rotationConvergeThreshold = - 1;

		this.translationFactor = - 1;
		this.rotationFactor = - 1;

		this.translationErrorClamp = - 1;
		this.rotationErrorClamp = - 1;

		this.stallThreshold = - 1;
		this.dampingFactor = - 1;
		this.divergeThreshold = - 1;
		this.restPoseFactor = - 1;

		// Cached jacobian and pseudo-inverse for warm start
		this.prevJacobian = mat.create( 0, 0 );
		this.prevPseudoInverse = mat.create( 0, 0 );

		this.init();

	}

	init() {

		// Find all joints with targets.
		const chain = this.chain;
		const targets = chain.filter( j => j.targetSet || j.isClosure );

		const lockedJointDoF = new Map();
		const lockedJointDoFCount = new Map();
		const prevDoFValues = new Map();

		const affectedClosures = new Map();
		const affectedConnectedClosures = new Map();
		chain.forEach( j => {

			// Track which joints will have a direct affect on which targets move
			// for closure end effectors.
			affectedClosures.set( j, new Set() );
			affectedConnectedClosures.set( j, new Set() );

			// Initialize our array with all possible degrees of freedom
			lockedJointDoF.set( j, new Uint8Array( 6 ) );
			prevDoFValues.set( j, new Float64Array( 6 ) );

		} );

		targets.forEach( target => {

			if ( target.isClosure ) {

				let currJoint = target;

				// climb the joint tree and mark every joint as affecting this closure end.
				while ( currJoint ) {

					if ( currJoint.isJoint ) {

						affectedClosures.get( currJoint ).add( target );

					}

					currJoint = currJoint.parent;

				}

				// and mark the joints up the other chain as effecting the other connector link.
				currJoint = target.child;
				while ( currJoint ) {

					if ( currJoint.isJoint ) {

						affectedConnectedClosures.get( currJoint ).add( target );

					}

					currJoint = currJoint.parent;

				}

			}

		} );

		this.targets = targets;
		this.affectedClosures = affectedClosures;
		this.affectedConnectedClosures = affectedConnectedClosures;
		this.lockedJointDoF = lockedJointDoF;
		this.lockedJointDoFCount = lockedJointDoFCount;
		this.prevDoFValues = prevDoFValues;

	}

	solve() {

		const {
			divergeThreshold,
			stallThreshold,
			chain,
			restPoseFactor,
			lockedJointDoFCount,
			prevDoFValues,
			useSVD,
			matrixPool,
			dampingFactor,
			maxIterations,
		} = this;

		// Store original error clamps for backtracking
		const originalTranslationErrorClamp = this.translationErrorClamp;
		const originalRotationErrorClamp = this.rotationErrorClamp;
		let errorClampFactor = 1;

		let iterations = 0;
		let prevErrorMagnitude = Infinity;
		let status = - 1;

		// Clear out all the locked joints
		lockedJointDoFCount.clear();

		// TODO: instead of trying to use minimal euler angles we should try to represent joint
		// error as a quaternion in the quaternion vector.
		for ( let i = 0, l = chain.length; i < l; i ++ ) {

			const joint = chain[ i ];
			if ( joint.targetSet || joint.restPoseSet ) {

				joint.tryMinimizeEulerAngles();

			}

		}

		do {

			matrixPool.releaseAll();

			// Make sure our matrices are all up to date
			for ( let i = 0, l = chain.length; i < l; i ++ ) {

				const joint = chain[ i ];
				joint.updateMatrixWorld();

			}

			// TODO: this only needs to be recomputed if a joint was locked so maybe lets check that? We also
			// lock joints inside this function so maybe we can forgo that?
			targetJoints.length = 0;
			freeJoints.length = 0;
			this.countUnconvergedVariables( freeJoints, targetJoints, dofResultInfo );
			const { freeDoF, errorRows, totalError } = dofResultInfo;

			// Check if we've converged
			if ( errorRows === 0 ) {

				status = SOLVE_STATUS.CONVERGED;
				break;

			}

			// Check if we've diverged - backtrack with smaller step
			if ( totalError > prevErrorMagnitude + divergeThreshold ) {

				// Revert joint values and update matrices
				prevDoFValues.forEach( ( dofValues, joint ) => {

					joint.dofValues.set( dofValues );
					joint.setMatrixDoFNeedsUpdate();
					joint.updateMatrixWorld();

				} );

				// Halve error clamps to take smaller steps
				errorClampFactor *= 0.5;
				this.translationErrorClamp = originalTranslationErrorClamp * errorClampFactor;
				this.rotationErrorClamp = originalRotationErrorClamp * errorClampFactor;

				// If we've taken a max number of steps or too many iterations then give up
				if ( errorClampFactor < 0.5 ** 6 || iterations > maxIterations ) {

					status = SOLVE_STATUS.DIVERGED;
					break;

				}

			} else {

				// Update the previous error and cache joint state for divergence check next frame
				// Because we haven't diverged these values are in a known good state
				prevErrorMagnitude = totalError;
				prevDoFValues.forEach( ( dofValues, joint ) => {

					dofValues.set( joint.dofValues );

				} );

			}

			// Check if we've hit max iterations
			if ( iterations > maxIterations ) {

				status = SOLVE_STATUS.TIMEOUT;
				break;

			}

			// A * x = b
			// find x such that it yields b where is the clamped error we're trying to work towards
			// and A is the jacobian, and x is the delta joint angles.

			const errorVector = matrixPool.get( errorRows, 1 );
			this.fillErrorVector( targetJoints, errorVector );

			const jacobian = matrixPool.get( errorRows, freeDoF );
			this.fillJacobian( targetJoints, freeJoints, jacobian );

			// Solve for the pseudo inverse of the jacobian
			const pseudoInverse = matrixPool.get( freeDoF, errorRows );
			if ( this.jacobianCacheEquals( jacobian ) ) {

				this.restorePseudoInverse( pseudoInverse );

			} else {

				let failedSVD = false;
				if ( useSVD ) {

					try {

						const m = errorRows;
						const n = freeDoF;
						const k = Math.min( m, n );

						const u = matrixPool.get( m, k ); // m x k
						const q = matrixPool.get( k, k ); // k x k
						const v = matrixPool.get( n, k ); // ( k x n )^T -> ( n x k )

						mat.svd( u, q, v, jacobian );

						const uTranspose = matrixPool.get( k, m );
						const qInverse = matrixPool.get( k, k );
						mat.transpose( uTranspose, u );

						// Damped pseudo-inverse: σ / (σ² + λ²)
						// This gives smooth behavior near singularities instead of hard truncation
						const lambda2 = dampingFactor ** 2;
						for ( let i = 0, l = q.length; i < l; i ++ ) {

							const sigma = mat.get( q, i, i );
							const inv = sigma / ( sigma * sigma + lambda2 );
							mat.set( qInverse, i, i, inv );

						}

						// V * Qinv * Ut
						const vqinv = matrixPool.get( n, k );
						mat.multiply( vqinv, v, qInverse );
						mat.multiply( pseudoInverse, vqinv, uTranspose );

					} catch {

						failedSVD = true;

					}

				}

				if ( ! useSVD || failedSVD ) {

					// Use a transpose pseudo inverse approach: A^T * A * x = A^T * b with the damping term
					// J^T * J * x = J^T * e
					// x = J^T * ( J * J^T )^-1 * e

					// and with the adding damping
					// x = J^T * ( J * J^T + l^2 * I )^-1 * e

					// l^2 * I
					const jacobianIdentityDamping = matrixPool.get( errorRows, errorRows );
					mat.identity( jacobianIdentityDamping );
					mat.scale( jacobianIdentityDamping, jacobianIdentityDamping, this.dampingFactor ** 2 );

					// J^T
					const jacobianTranspose = matrixPool.get( freeDoF, errorRows );
					mat.transpose( jacobianTranspose, jacobian );

					// J * J^T
					const jjt = matrixPool.get( errorRows, errorRows );
					mat.multiply( jjt, jacobian, jacobianTranspose );

					// J * J^T + l^2 * I
					const jjti = matrixPool.get( errorRows, errorRows );
					mat.add( jjti, jjt, jacobianIdentityDamping );

					// ( J * J^T + l^2 * I )^-1
					const jjtii = matrixPool.get( errorRows, errorRows );
					mat.invert( jjtii, jjti );

					// J^T * ( J * J^T + l^2 * I )^-1
					mat.multiply( pseudoInverse, jacobianTranspose, jjtii );

				}

				// save the results for warm start
				this.cacheJacobianResult( jacobian, pseudoInverse );

			}

			// x = deltaTheta = J^T * ( J * J^T + l^2 * I )^-1 * e
			const deltaTheta = matrixPool.get( freeDoF, 1 );
			mat.multiply( deltaTheta, pseudoInverse, errorVector );

			if ( restPoseFactor !== 0 ) {

				// Nullspace Projection
				// I - J^-1 * J is the orthogonal null space of J where J^-1 is the pseudoinverse
				// Multiplied by the rest position of each dof
				// ( I - J^-1 * J ) * restPose
				const restPose = matrixPool.get( freeDoF, 1 );
				const restPoseResult = matrixPool.get( freeDoF, 1 );
				let colIndex = 0;
				for ( let i = 0, l = freeJoints.length; i < l; i ++ ) {

					const joint = freeJoints[ i ];
					const lockedDoFCount = this.lockedJointDoFCount.get( joint ) || 0;
					const isLocked = lockedDoFCount !== 0;
					const lockedDoF = this.lockedJointDoF.get( joint );

					const colCount = joint.rotationDoFCount + joint.translationDoFCount - lockedDoFCount;
					if ( joint.restPoseSet ) {

						const dofList = joint.dof;
						const dofValues = joint.dofValues;
						const dofRestPose = joint.dofRestPose;
						for ( let d = 0; d < colCount; d ++ ) {

							const dof = dofList[ d ];

							if ( isLocked && lockedDoF[ dof ] ) continue;

							mat.set( restPose, colIndex, 0, dofRestPose[ dof ] - dofValues[ dof ] );
							colIndex ++;

						}

					} else {

						// No rest pose set, values already zeroed
						colIndex += colCount;

					}

				}

				// Nullspace projection: "restPose - J^-1 * (J * restPose)" which is mathematically
				// equivalent to "(I - J^-1 * J) * restPose". This version avoids constructing and
				// performing a freeDoF x freeDoF multiplication needed for the identity calculations.

				// J * restPose > errorRows x 1
				const jRestPose = matrixPool.get( errorRows, 1 );
				mat.multiply( jRestPose, jacobian, restPose );

				// J^-1 * (J * restPose) > freeDoF x 1
				const jijRestPose = matrixPool.get( freeDoF, 1 );
				mat.multiply( jijRestPose, pseudoInverse, jRestPose );

				// restPose - J^-1 * (J * restPose) > freeDoF x 1
				mat.subtract( restPoseResult, restPose, jijRestPose );

				for ( let r = 0; r < freeDoF; r ++ ) {

					const val = mat.get( restPoseResult, r, 0 );
					mat.set( deltaTheta, r, 0, mat.get( deltaTheta, r, 0 ) + val * restPoseFactor );

				}

			}

			// Check if our joints have not moved and returned stalled
			if ( stallThreshold > 0 ) {

				let stalled = true;
				for ( let i = 0, l = deltaTheta.length; i < l; i ++ ) {

					const delta = mat.get( deltaTheta, i, 0 );
					if ( Math.abs( delta ) > stallThreshold ) {

						stalled = false;
						break;

					}

				}

				if ( stalled ) {

					status = SOLVE_STATUS.STALLED;
					break;

				}

			}

			// Apply joint angles
			this.applyJointAngles( freeJoints, deltaTheta );

			// there's still error and we're under the max iterations
			iterations ++;

		} while ( true ); // eslint-disable-line

		// Restore original error clamps in case it was modified during divergence checks
		this.translationErrorClamp = originalTranslationErrorClamp;
		this.rotationErrorClamp = originalRotationErrorClamp;

		targetJoints.length = 0;
		freeJoints.length = 0;
		return status;

	}

	// Apply the delta values from the solve to the free joints in the list
	applyJointAngles( freeJoints, deltaTheta ) {

		const {
			lockedJointDoF,
			lockedJointDoFCount,
		} = this;

		let lockedJoint = false;
		let dti = 0;
		for ( let i = 0, l = freeJoints.length; i < l; i ++ ) {

			// Apply the delta to every free joint
			const joint = freeJoints[ i ];
			const dofList = joint.dof;
			const lockedDoF = lockedJointDoF.get( joint );
			const isLocked = lockedJointDoFCount.has( joint );

			for ( let d = 0, l = dofList.length; d < l; d ++ ) {

				const dof = dofList[ d ];
				if ( isLocked && lockedDoF[ dof ] ) {

					continue;

				}

				const value = joint.getDoFValue( dof );
				const hitLimit = joint.setDoFValue( dof, value + mat.get( deltaTheta, dti, 0 ) );

				// lock the joint if we hit a limit
				if ( hitLimit ) {

					if ( ! lockedJointDoFCount.has( joint ) ) {

						lockedJointDoFCount.set( joint, 0 );
						lockedDoF.fill( 0 );

					}

					const lockedCount = lockedJointDoFCount.get( joint );
					lockedJointDoFCount.set( joint, lockedCount + 1 );
					lockedDoF[ dof ] = 1;
					lockedJoint = true;

				}

				dti ++;

			}

		}

		if ( dti !== deltaTheta.length ) {

			throw new Error();

		}

		return lockedJoint;

	}

	// generate the jacobian
	// The jacobian has one column for each free degree of freedom and a row for every
	// target degree of freedom we have.
	fillJacobian( targetJoints, freeJoints, outJacobian ) {

		const {
			lockedJointDoF,
			lockedJointDoFCount,
			translationFactor,
			rotationFactor,
		} = this;

		const affectedClosures = this.affectedClosures;
		const affectedConnectedClosures = this.affectedConnectedClosures;

		let colIndex = 0;
		for ( let c = 0, tc = freeJoints.length; c < tc; c ++ ) {

			const freeJoint = freeJoints[ c ];
			const relevantClosures = affectedClosures.get( freeJoint );
			const relevantConnectedClosures = affectedConnectedClosures.get( freeJoint );
			const dofList = freeJoint.dof;
			const colCount = freeJoint.translationDoFCount + freeJoint.rotationDoFCount;
			const identityDoFMatrixWorld = freeJoint.cachedIdentityDoFMatrixWorld;

			const isLocked = lockedJointDoFCount.has( freeJoint );
			const lockedDoF = lockedJointDoF.get( freeJoint );

			// iterate over every degree of freedom in the joint
			for ( let co = 0; co < colCount; co ++ ) {

				const dof = dofList[ co ];

				// skip this joint if it's locked
				if ( isLocked && lockedDoF[ dof ] ) {

					continue;

				}

				let rowIndex = 0;

				// Iterate over every target
				for ( let r = 0, tr = targetJoints.length; r < tr; r ++ ) {

					const targetJoint = targetJoints[ r ];

					// if it's a closure target
					if ( targetJoint.isClosure ) {

						if ( relevantClosures.has( targetJoint ) || relevantConnectedClosures.has( targetJoint ) ) {

							// Determine which position we're affecting and the sign. If we're the connected child then
							// we need to invert the change needed.
							const isConnected = relevantConnectedClosures.has( targetJoint );

							// Transform local axis to world space using the rotation part of the matrix
							mat4.getRotation( tempAxisQuat, identityDoFMatrixWorld );
							vec3.transformQuat( axisWorld, AXES[ dof ], tempAxisQuat );

							if ( dof < 3 ) {

								// translation
								vec3.copy( tempPos, axisWorld );
								tempRotVec[ 0 ] = 0;
								tempRotVec[ 1 ] = 0;
								tempRotVec[ 2 ] = 0;

							} else {

								// rotation
								// get the target position which is needed to calculate the impact of rotation
								const affectedMatrix = isConnected ? targetJoint.child.matrixWorld : targetJoint.matrixWorld;
								mat4.getTranslation( targetWorldPos, affectedMatrix );

								// get relative position
								mat4.getTranslation( jointWorldPos, identityDoFMatrixWorld );
								vec3.subtract( toTarget, targetWorldPos, jointWorldPos );

								// the change of a point by a rotation about an axis is the cross vector
								vec3.cross( tempPos, axisWorld, toTarget );

								// for a rotation vector the delta is the same as the axis of rotation
								vec3.copy( tempRotVec, axisWorld );

							}

							// Error is defined as (closure - child), so:
							// - For direct closures: moving closure changes error positively, so negate
							// - For connected closures: moving child changes error negatively, so keep positive
							const sign = isConnected ? 1 : - 1;
							vec3.scale( tempPos, tempPos, sign * translationFactor );
							vec3.scale( tempRotVec, tempRotVec, sign * rotationFactor );

							// TODO: Goals use DoF-based row selection, non-Goal closures hardcode all 6.
							// See solver.js for details on unifying closure semantics.
							if ( targetJoint.isGoal ) {

								const { translationDoFCount, rotationDoFCount, dof } = targetJoint;
								for ( let i = 0; i < translationDoFCount; i ++ ) {

									const d = dof[ i ];
									mat.set( outJacobian, rowIndex + i, colIndex, tempPos[ d ] );

								}

								for ( let i = 0; i < rotationDoFCount; i ++ ) {

									const d = dof[ translationDoFCount + i ];
									mat.set( outJacobian, rowIndex + translationDoFCount + i, colIndex, tempRotVec[ d - 3 ] );

								}

								rowIndex += translationDoFCount + rotationDoFCount;

							} else {

								// set translation
								mat.set( outJacobian, rowIndex + 0, colIndex, tempPos[ 0 ] );
								mat.set( outJacobian, rowIndex + 1, colIndex, tempPos[ 1 ] );
								mat.set( outJacobian, rowIndex + 2, colIndex, tempPos[ 2 ] );

								// set rotation vector
								mat.set( outJacobian, rowIndex + 3, colIndex, tempRotVec[ 0 ] );
								mat.set( outJacobian, rowIndex + 4, colIndex, tempRotVec[ 1 ] );
								mat.set( outJacobian, rowIndex + 5, colIndex, tempRotVec[ 2 ] );
								rowIndex += 6;

							}

						} else {

							// Target isn't relevant, values already zeroed
							if ( targetJoint.isGoal ) {

								rowIndex += targetJoint.translationDoFCount + targetJoint.rotationDoFCount;

							} else {

								rowIndex += 6;

							}

						}

					}

					// Check if this joint has a target set and update the jacobian rows if it does
					if ( targetJoint.targetSet ) {

						const rowCount = targetJoint.translationDoFCount + targetJoint.rotationDoFCount;

						if ( freeJoint === targetJoint ) {

							// if we're just dealing with a target dof joint then there can't be any influence
							// but otherwise the only joint that can have an effect on this error is the joint
							// itself.
							// TODO: Having noted that is this really necessary? Is there any way that this doesn't just
							// jump to the solution and lock? How can we afford some slack? With a low weight? Does that
							// get applied here?
							// TODO: If this joint happens to have three euler joints we need to use a quat here. Otherwise we
							// use the euler angles.
							for ( let i = 0; i < rowCount; i ++ ) {

								mat.set( outJacobian, rowIndex + colIndex, colIndex, - 1 );

							}

						}

						// else: values already zeroed
						rowIndex += rowCount;

					}

				}

				colIndex ++;

			}

		}

		if ( colIndex !== outJacobian[ 0 ].length ) {

			throw new Error();

		}

	}

	// Fill in the error vector
	fillErrorVector( targetJoints, errorVector ) {

		let rowIndex = 0;
		for ( let i = 0, l = targetJoints.length; i < l; i ++ ) {

			const joint = targetJoints[ i ];
			if ( joint.isClosure ) {

				accumulateClosureError( this, joint, rowIndex, errorVector, errorResultInfo );
				rowIndex += errorResultInfo.rowCount;

			}

			if ( joint.targetSet ) {

				accumulateTargetError( this, joint, rowIndex, errorVector, errorResultInfo );
				rowIndex += errorResultInfo.rowCount;

			}

		}

	}

	// Count the unconverged targets in the chain and store them in targetJoints and store
	// any freeJoints in
	countUnconvergedVariables( freeJoints, targetJoints, dofResultInfo ) {

		const { lockedJointDoFCount } = this;

		const chain = this.chain;
		let totalError = 0;
		let errorRows = 0;
		let unconvergedRows = 0;
		let freeDoF = 0;
		for ( let i = 0, l = chain.length; i < l; i ++ ) {

			let addToTargetList = false;
			const joint = chain[ i ];
			const lockedDoF = lockedJointDoFCount.get( joint ) || 0;

			// TODO: Should we check every variable against the convergence threshold or is
			// it better to check the magnitude?

			// TODO: We may be able to speed this up by using the square distance and length
			// to compare error.

			// TODO: If this is a goal we shouldnt add to the free dof because they won't be added
			// to the jacobian

			// If this is a closure joint then we need to make sure we're solving
			// for the other child end to meet this joint so this error is important.
			if ( joint.isClosure ) {

				accumulateClosureError( this, joint, errorRows, null, errorResultInfo );
				if ( ! errorResultInfo.isConverged ) {

					unconvergedRows += errorResultInfo.rowCount;
					totalError += errorResultInfo.totalError;

				}

				addToTargetList = true;
				errorRows += errorResultInfo.rowCount;

			}

			// Check out far the joint is from the target dof value.
			const dofList = joint.dof;
			if ( joint.targetSet ) {

				accumulateTargetError( this, joint, errorRows, null, errorResultInfo );
				if ( ! errorResultInfo.isConverged ) {

					unconvergedRows += errorResultInfo.rowCount;
					totalError += errorResultInfo.totalError;

				}

				addToTargetList = true;
				errorRows += errorResultInfo.rowCount;

			}

			if ( ! joint.isGoal && dofList.length > 0 ) {

				freeDoF += dofList.length - lockedDoF;
				freeJoints.push( joint );

			}

			if ( addToTargetList ) {

				targetJoints.push( joint );

			}

		}

		// if it turns out that everything is converged.
		if ( unconvergedRows === 0 ) {

			errorRows = 0;

		}

		dofResultInfo.errorRows = errorRows;
		dofResultInfo.freeDoF = freeDoF;
		dofResultInfo.totalError = totalError;

	}

	// Check if the cached jacobian equals the given jacobian
	jacobianCacheEquals( matrix ) {

		return mat.equalSubMatrix( this.prevJacobian, matrix, matrix.rows, matrix.cols );

	}

	// Copy cached pseudo-inverse to the output matrix
	restorePseudoInverse( target ) {

		mat.copySubMatrix( target, this.prevPseudoInverse, target.rows, target.cols );

	}

	cacheJacobianResult( jacobian, pseudoInverse ) {

		// grow the cached matrices if needed
		const { rows, cols } = jacobian;
		if ( this.prevJacobian.rows < rows || this.prevJacobian.cols < cols ) {

			this.prevJacobian = mat.create( rows, cols );

		}

		if ( this.prevPseudoInverse.rows < pseudoInverse.rows || this.prevPseudoInverse.cols < pseudoInverse.cols ) {

			this.prevPseudoInverse = mat.create( pseudoInverse.rows, pseudoInverse.cols );

		}

		// fill with Infinity to invalidate stale data beyond current dimensions
		mat.fill( this.prevJacobian, Infinity );
		mat.fill( this.prevPseudoInverse, Infinity );

		// copy the latest data
		mat.copySubMatrix( this.prevJacobian, jacobian, rows, cols );
		mat.copySubMatrix( this.prevPseudoInverse, pseudoInverse, pseudoInverse.rows, pseudoInverse.cols );

	}

}
