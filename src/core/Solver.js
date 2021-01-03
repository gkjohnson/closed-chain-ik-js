import { ChainSolver } from './ChainSolver.js';
import { findRoots } from './utils/findRoots.js';
import { MatrixPool } from './MatrixPool.js';

export class Solver {

	constructor( roots = [] ) {

		this.matrixPool = new MatrixPool();

		this.useSVD = false;

		this.maxIterations = 5;
		this.stallThreshold = 1e-4;
		this.dampingFactor = 0.001;
		this.divergeThreshold = 0.01;
		this.restPoseFactor = 0.01;

		this.translationConvergeThreshold = 1e-3;
		this.rotationConvergeThreshold = 1e-5;

		this.translationFactor = 1;
		this.rotationFactor = 1;

		this.translationStep = 1e-3;
		this.rotationStep = 1e-3;

		this.translationErrorClamp = 0.1;
		this.rotationErrorClamp = 0.1;

		this.roots = Array.isArray( roots ) ? [ ...roots ] : [ roots ];
		this.solvers = null;

		this.updateStructure();

	}

	// needs to be called whenever tree structure is updated
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

			s.translationStep = this.translationStep;
			s.rotationStep = this.rotationStep;

			s.translationErrorClamp = this.translationErrorClamp;
			s.rotationErrorClamp = this.rotationErrorClamp;

			const result = s.solve();
			results.push( result );

		}

		return results;

	}

}
