/** @import { Frame } from './Frame.js' */
import { ChainSolver } from './ChainSolver.js';
import { findRoots } from './utils/IKUtils.js';
import { MatrixPool } from './MatrixPool.js';

/**
 * Solves the closure and joint target constraints of a system of frames using damped least
 * squares. Every independent chain of joints found in the roots is solved separately.
 * @param {Frame | Array<Frame>} roots - The roots of the trees to solve.
 */
export class Solver {

	constructor( roots = [] ) {

		this.matrixPool = new MatrixPool();

		/**
		 * Use the SVD to compute the damped pseudo inverse of the jacobian, which adds damping in
		 * near singular directions to keep steps bounded near singularities. Falls back to the
		 * transpose method if the SVD cannot be computed.
		 * @type {boolean}
		 * @default false
		 */
		this.useSVD = false;

		/**
		 * Maximum number of iterations per solve. The solve terminates with
		 * `SOLVE_STATUS.TIMEOUT` when exceeded.
		 * @type {number}
		 * @default 5
		 */
		this.maxIterations = 5;

		/**
		 * If no joint moves more than this in an iteration the solve terminates with
		 * `SOLVE_STATUS.STALLED`.
		 * @type {number}
		 * @default 1e-4
		 */
		this.stallThreshold = 1e-4;

		/**
		 * Base damping factor of the damped least squares solve.
		 * @type {number}
		 * @default 0.001
		 */
		this.dampingFactor = 0.001;

		/**
		 * Amount the error may grow in a single step before the step is rejected and retried at
		 * a smaller scale. If no scale keeps the error within this threshold the solve terminates
		 * with `SOLVE_STATUS.DIVERGED`.
		 * @type {number}
		 * @default 0.01
		 */
		this.divergeThreshold = 0.01;

		/**
		 * Factor with which joints that have a rest pose set are moved toward it without
		 * compromising the other goals.
		 * @type {number}
		 * @default 0.01
		 */
		this.restPoseFactor = 0.01;

		/**
		 * Translation error under which a goal is considered met. The solve terminates with
		 * `SOLVE_STATUS.CONVERGED` when every goal is met.
		 * @type {number}
		 * @default 1e-3
		 */
		this.translationConvergeThreshold = 1e-3;

		/**
		 * Rotation error under which a goal is considered met. The solve terminates with
		 * `SOLVE_STATUS.CONVERGED` when every goal is met.
		 * @type {number}
		 * @default 1e-5
		 */
		this.rotationConvergeThreshold = 1e-5;

		/**
		 * Weight applied to translation error. Useful for balancing translation against rotation
		 * when one is solved for more strongly than the other. Expected to be in `[ 0, 1 ]`.
		 * @type {number}
		 * @default 1
		 */
		this.translationFactor = 1;

		/**
		 * Weight applied to rotation error. Useful for balancing rotation against translation
		 * when one is solved for more strongly than the other. Expected to be in `[ 0, 1 ]`.
		 * @type {number}
		 * @default 1
		 */
		this.rotationFactor = 1;

		/**
		 * Maximum translation error targeted in a single step. Larger values may solve faster but
		 * are more likely to overshoot.
		 * @type {number}
		 * @default 0.1
		 */
		this.translationErrorClamp = 0.1;

		/**
		 * Maximum rotation error targeted in a single step. Larger values may solve faster but
		 * are more likely to overshoot.
		 * @type {number}
		 * @default 0.1
		 */
		this.rotationErrorClamp = 0.1;

		/**
		 * The roots to solve for. When `updateStructure` is called the roots are traversed,
		 * including closure connections, to find every connected tree. If modified
		 * `updateStructure` must be called.
		 * @type {Array<Frame>}
		 */
		this.roots = Array.isArray( roots ) ? [ ...roots ] : [ roots ];
		this.solvers = null;

		this.updateStructure();

	}

	/**
	 * Rebuilds the joint chains to solve. Must be called whenever the parent child structure of
	 * the trees, the degrees of freedom of a joint, or `roots` change.
	 */
	updateStructure() {

		const roots = findRoots( this.roots );
		const chains = [];
		const traversal = new Set();
		const allChainJoints = new Set();
		const traverseChains = frame => {

			// If we found a joint then add it to the traversal list
			if ( frame.isJoint ) {

				const joint = frame;
				traversal.add( joint );

				// If we found a closure joint
				if ( joint.isClosure ) {

					// Traverse back up the tree until we find a common ancestor
					// and create a new chain
					const chainSet = new Set();
					let curr = joint.child;
					while ( curr ) {

						if ( curr.isJoint ) {

							if ( traversal.has( curr ) ) {

								break;

							} else {

								chainSet.add( curr );
								allChainJoints.add( curr );

							}

						}

						curr = curr.parent;

					}

					traversal.forEach( c => {

						chainSet.add( c );
						allChainJoints.add( c );

					} );
					chains.push( chainSet );

				}

			}

			// Continue traversing
			const children = frame.children;
			for ( let i = 0, l = children.length; i < l; i ++ ) {

				traverseChains( children[ i ] );

			}

			// Remove the joint from our traversal set
			traversal.delete( frame );

		};

		// find all chains in the roots
		roots.forEach( traverseChains );

		// Merge interdependent chains
		const independentChains = [];
		while ( chains.length ) {

			const currChain = chains.pop();
			independentChains.push( currChain );
			for ( let i = 0; i < chains.length; i ++ ) {

				// see if this chain is dependent on the current chain
				// and if so merge the chains.
				const otherChain = chains[ i ];

				let dependent = false;
				otherChain.forEach( c => {

					dependent = dependent || currChain.has( c );

				} );

				if ( dependent ) {

					otherChain.forEach( c => currChain.add( c ) );
					chains.splice( i, 1 );
					i --;

				}

			}

		}

		// Find any joints that aren't considered part of a solve chain so we
		// can just update them using forward kinematics.
		const nonChainJoints = new Set();
		roots.forEach( root => root.traverse( c => {

			if ( c.isJoint && c.dof.length > 0 && ! allChainJoints.has( c ) ) {

				nonChainJoints.add( c );

			}

		} ) );

		// Create the solvers for the chains
		this.solvers = independentChains.map( c => new ChainSolver( c ) );
		this.nonChainJoints = nonChainJoints;

	}

	/**
	 * Runs a solve on every independent joint chain and returns a `SOLVE_STATUS` for each.
	 * @returns {Array<number>}
	 */
	solve() {

		const { solvers, nonChainJoints } = this;

		// update any non chain joints
		nonChainJoints.forEach( joint => {

			if ( joint.targetSet ) {

				joint.dofValues.set( joint.dofTarget );
				joint.setMatrixDoFNeedsUpdate();

			}

		} );

		const results = [];
		for ( let i = 0, l = solvers.length; i < l; i ++ ) {

			const s = solvers[ i ];
			s.matrixPool = this.matrixPool;

			s.useSVD = this.useSVD;

			s.maxIterations = this.maxIterations;
			s.stallThreshold = this.stallThreshold;
			s.dampingFactor = this.dampingFactor;
			s.divergeThreshold = this.divergeThreshold;
			s.restPoseFactor = this.restPoseFactor;

			s.translationConvergeThreshold = this.translationConvergeThreshold;
			s.rotationConvergeThreshold = this.rotationConvergeThreshold;

			s.translationFactor = this.translationFactor;
			s.rotationFactor = this.rotationFactor;

			s.translationErrorClamp = this.translationErrorClamp;
			s.rotationErrorClamp = this.rotationErrorClamp;

			const result = s.solve();
			results.push( result );

		}

		return results;

	}

}
