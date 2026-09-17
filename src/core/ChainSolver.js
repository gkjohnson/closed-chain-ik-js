import { vec3, mat4 } from 'gl-matrix';
import { accumulateClosureError, accumulateTargetError, getClosureRowCount } from './utils/solver.js';
import { mat } from './utils/matrix.js';
import { AXES } from './utils/constants.js';

// temp reusable variables
const tempRotVec = new Float64Array( 3 );
const tempPos = new Float64Array( 3 );
const pivotWorldPos = new Float64Array( 3 );
const frameWorldPos = new Float64Array( 3 );
const axisWorld = new Float64Array( 3 );
const leverArm = new Float64Array( 3 );

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

// number of step scales tried along a line search before the solve is considered diverged
const MAX_LINE_SEARCH_STEPS = 6;

// singular values below this fraction of the largest are treated as near singular. This is the
// lowest ratio used and it is raised when full steps are rejected up to the max ratio.
const SINGULARITY_RATIO = 0.02;
const MAX_SINGULARITY_RATIO = 0.2;

/**
 * Statuses returned for each independent chain by `Solver.solve`.
 *
 * ```js
 * // Error for all goals is within the convergence thresholds.
 * SOLVE_STATUS.CONVERGED
 *
 * // No joint moved more than the stall threshold or no joints are free to move.
 * SOLVE_STATUS.STALLED
 *
 * // No step scale could keep the error within the divergence threshold.
 * SOLVE_STATUS.DIVERGED
 *
 * // The maximum number of iterations was reached.
 * SOLVE_STATUS.TIMEOUT
 * ```
 * @type {Object<string, number>}
 */
export const SOLVE_STATUS = {

	CONVERGED: 0,
	STALLED: 1,
	DIVERGED: 2,
	TIMEOUT: 3,

};

/**
 * Names of the solve statuses indexed by status value.
 * @type {Array<string>}
 */
export const SOLVE_STATUS_NAMES = Object.entries( SOLVE_STATUS ).sort( ( a, b ) => a[ 1 ] - b[ 1 ] ).map( el => el[ 0 ] );

// Adds how the frame at "frameMatrix" moves for a unit rotation about "rotationAxis" through
// "pivotPos". "errorSign" is +1 or -1 depending on whether moving the frame raises or lowers
// the closure error.
function accumulateRotationInfluence( rotationAxis, pivotPos, frameMatrix, errorSign, outPos, outRotVec ) {

	// the frame position sweeps around the pivot
	mat4.getTranslation( frameWorldPos, frameMatrix );
	vec3.subtract( leverArm, frameWorldPos, pivotPos );
	vec3.cross( leverArm, rotationAxis, leverArm );
	vec3.scaleAndAdd( outPos, outPos, leverArm, errorSign );

	// the frame rotation changes along the axis
	vec3.scaleAndAdd( outRotVec, outRotVec, rotationAxis, errorSign );

}

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

		// near singular ratio used by the SVD path. Raised when full steps are rejected and lowered
		// when they are accepted or the solve stalls. Persists across solves.
		this.singularityRatio = SINGULARITY_RATIO;

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

		let iterations = 0;
		let status = - 1;

		// Clear out all the locked joints
		lockedJointDoFCount.clear();

		// Invalidate the cached pseudo inverse since solver settings may have changed
		mat.fill( this.prevJacobian, Infinity );

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

			// Nothing can move if there are no free degrees of freedom
			if ( freeDoF === 0 ) {

				status = SOLVE_STATUS.STALLED;
				break;

			}

			// Cache the joint state so a rejected step can be reverted
			prevDoFValues.forEach( ( dofValues, joint ) => {

				dofValues.set( joint.dofValues );

			} );

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
						// Singular values that are small relative to the largest get additional damping that
						// ramps up as they approach zero so steps stay bounded near singularities.
						// See Chiaverini, Siciliano, Egeland, "Review of the damped least-squares inverse kinematics
						// with experiments on an industrial robot manipulator", IEEE Trans. Control Systems Technology, 1994
						// and Section III-B, eq. 12 of Colomé, Torras, "Closed-Loop Inverse Kinematics for Redundant Robots:
						// Comparative Assessment and Two Enhancements", IEEE/ASME Trans. Mechatronics, 2015.
						// https://digital.csic.es/bitstream/10261/133046/1/Two%20Enhancements.pdf
						let sigmaMax = 0;
						for ( let i = 0, l = q.length; i < l; i ++ ) {

							sigmaMax = Math.max( sigmaMax, mat.get( q, i, i ) );

						}

						const singularityThreshold = sigmaMax * this.singularityRatio;
						const lambda2 = dampingFactor ** 2;
						for ( let i = 0, l = q.length; i < l; i ++ ) {

							const sigma = mat.get( q, i, i );
							let damping = lambda2;
							if ( sigma < singularityThreshold ) {

								const ratio = sigma / singularityThreshold;
								damping += singularityThreshold * singularityThreshold * ( 1 - ratio * ratio );

							}

							const inv = sigma / ( sigma * sigma + damping );
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

					// the near singular damping may be what is holding the joints still
					this.singularityRatio = Math.max( SINGULARITY_RATIO, this.singularityRatio * 0.5 );
					status = SOLVE_STATUS.STALLED;
					break;

				}

			}

			// Line search: walk a single scale along the step, forward when the error improves on the best
			// so far and back when it does not, halving the walk each attempt. A step has to beat the
			// divergence tolerance to be kept at all.
			let stepScale = 1;
			let bestScale = 0;
			let bestError = totalError + divergeThreshold;
			for ( let attempt = 0; attempt < MAX_LINE_SEARCH_STEPS; attempt ++ ) {

				this.applyJointAngles( freeJoints, deltaTheta, stepScale );

				// the joint lists are rebuilt with the same contents since no joints are locked until
				// a step is accepted
				targetJoints.length = 0;
				freeJoints.length = 0;
				this.countUnconvergedVariables( freeJoints, targetJoints, dofResultInfo );

				const stepError = dofResultInfo.totalError;
				const improved = stepError < bestError;
				if ( improved ) {

					bestScale = stepScale;
					bestError = stepError;

				}

				// the full step is the best so there is nothing further along the line to search
				if ( bestScale === 1 ) {

					break;

				}

				this.revertJointAngles();
				const walk = 0.5 ** ( attempt + 1 );
				stepScale += improved ? walk : - walk;

			}

			// Adapt the near singular ratio: a rejected full step means the weak directions need more
			// damping, an accepted one means it can relax back toward the base ratio.
			if ( bestScale === 1 ) {

				this.singularityRatio = Math.max( SINGULARITY_RATIO, this.singularityRatio * 0.5 );

			} else {

				this.singularityRatio = Math.min( MAX_SINGULARITY_RATIO, this.singularityRatio * 2 );

			}

			if ( bestScale === 0 ) {

				status = SOLVE_STATUS.DIVERGED;
				break;

			}

			// reapply the best step found unless the full step was kept
			if ( bestScale !== 1 ) {

				this.applyJointAngles( freeJoints, deltaTheta, bestScale );

			}

			// Lock any joints that hit their limits during the accepted step
			this.lockLimitedJointAngles( freeJoints );

			// there's still error and we're under the max iterations
			iterations ++;

		} while ( true ); // eslint-disable-line

		targetJoints.length = 0;
		freeJoints.length = 0;
		return status;

	}

	// Apply the delta values from the solve to the free joints in the list scaled by the given amount
	applyJointAngles( freeJoints, deltaTheta, scale = 1 ) {

		const {
			lockedJointDoF,
			lockedJointDoFCount,
		} = this;

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
				joint.setDoFValue( dof, value + scale * mat.get( deltaTheta, dti, 0 ) );
				dti ++;

			}

		}

		if ( dti !== deltaTheta.length ) {

			throw new Error();

		}

	}

	// Restore the joint values cached at the start of the iteration
	revertJointAngles() {

		this.prevDoFValues.forEach( ( dofValues, joint ) => {

			joint.dofValues.set( dofValues );
			joint.setMatrixDoFNeedsUpdate();

		} );

	}

	// Lock any unlocked degrees of freedom that are sitting at a joint limit
	lockLimitedJointAngles( freeJoints ) {

		const {
			lockedJointDoF,
			lockedJointDoFCount,
		} = this;

		for ( let i = 0, l = freeJoints.length; i < l; i ++ ) {

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
				if ( value === joint.getMinLimit( dof ) || value === joint.getMaxLimit( dof ) ) {

					if ( ! lockedJointDoFCount.has( joint ) ) {

						lockedJointDoFCount.set( joint, 0 );
						lockedDoF.fill( 0 );

					}

					const lockedCount = lockedJointDoFCount.get( joint );
					lockedJointDoFCount.set( joint, lockedCount + 1 );
					lockedDoF[ dof ] = 1;

				}

			}

		}

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
			let jointColIndex = 0;
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

						const affectsClosure = relevantClosures.has( targetJoint );
						const affectsChild = relevantConnectedClosures.has( targetJoint );
						if ( affectsClosure || affectsChild ) {

							// Transform local axis to world space using the rotation part of the matrix
							mat4.getRotation( tempAxisQuat, identityDoFMatrixWorld );
							vec3.transformQuat( axisWorld, AXES[ dof ], tempAxisQuat );
							mat4.getTranslation( pivotWorldPos, identityDoFMatrixWorld );

							// The error is closure minus child, so moving the closure side counts as -1 and moving the
							// child side as +1. A joint above the fork moves both sides and the two cancel except for
							// the rotation of the offset between the frames while the closure is still open.
							vec3.zero( tempPos );
							vec3.zero( tempRotVec );
							if ( dof < 3 ) {

								// translation slides each affected frame along the axis
								if ( affectsClosure ) {

									vec3.subtract( tempPos, tempPos, axisWorld );

								}

								if ( affectsChild ) {

									vec3.add( tempPos, tempPos, axisWorld );

								}

							} else {

								// rotation swings each affected frame around the joint
								if ( affectsClosure ) {

									accumulateRotationInfluence( axisWorld, pivotWorldPos, targetJoint.matrixWorld, - 1, tempPos, tempRotVec );

								}

								if ( affectsChild ) {

									accumulateRotationInfluence( axisWorld, pivotWorldPos, targetJoint.child.matrixWorld, 1, tempPos, tempRotVec );

								}

							}

							vec3.scale( tempPos, tempPos, translationFactor );
							vec3.scale( tempRotVec, tempRotVec, rotationFactor );

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

							} else {

								// set translation
								mat.set( outJacobian, rowIndex + 0, colIndex, tempPos[ 0 ] );
								mat.set( outJacobian, rowIndex + 1, colIndex, tempPos[ 1 ] );
								mat.set( outJacobian, rowIndex + 2, colIndex, tempPos[ 2 ] );

								// set rotation vector
								mat.set( outJacobian, rowIndex + 3, colIndex, tempRotVec[ 0 ] );
								mat.set( outJacobian, rowIndex + 4, colIndex, tempRotVec[ 1 ] );
								mat.set( outJacobian, rowIndex + 5, colIndex, tempRotVec[ 2 ] );

							}

						}

						// else: target isn't relevant, values already zeroed
						rowIndex += getClosureRowCount( targetJoint );

					}

					// Check if this joint has a target set and update the jacobian rows if it does
					if ( targetJoint.targetSet ) {

						const rowCount = targetJoint.translationDoFCount + targetJoint.rotationDoFCount - ( lockedJointDoFCount.get( targetJoint ) || 0 );

						if ( freeJoint === targetJoint ) {

							// the only joint that can have an effect on this error is the joint itself and
							// each degree of freedom only affects its own row.
							// TODO: If this joint happens to have three euler joints we need to use a quat here. Otherwise we
							// use the euler angles.
							const factor = dof < 3 ? translationFactor : rotationFactor;
							mat.set( outJacobian, rowIndex + jointColIndex, colIndex, factor );

						}

						// else: values already zeroed
						rowIndex += rowCount;

					}

				}

				colIndex ++;
				jointColIndex ++;

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
