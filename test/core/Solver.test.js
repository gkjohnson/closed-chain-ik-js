import { Joint, DOF } from '../../src/core/Joint.js';
import { Link } from '../../src/core/Link.js';
import { Goal } from '../../src/core/Goal.js';
import { Solver } from '../../src/core/Solver.js';
import { ChainSolver, SOLVE_STATUS } from '../../src/core/ChainSolver.js';
import { mat } from '../../src/core/utils/matrix.js';

// closure error of a goal masked to the goal's constrained DoF, matching what the solver minimizes
function getClosureErrorMagnitude( goal ) {

	const pos = new Float64Array( 3 );
	const rot = new Float64Array( 3 );
	goal.getClosureError( pos, rot );

	const { dofFlags, rotationDoFCount } = goal;
	const posMag = Math.hypot( pos[ 0 ] * dofFlags[ 0 ], pos[ 1 ] * dofFlags[ 1 ], pos[ 2 ] * dofFlags[ 2 ] );
	const rotMag = rotationDoFCount === 0 ? 0 : Math.hypot( rot[ 0 ], rot[ 1 ], rot[ 2 ] );
	return posMag + rotMag;

}

// root -> link -> joint -> link with a position goal on the last link
function createChain() {

	const root = new Joint();
	const rootLink = new Link();
	const joint = new Joint();
	const link = new Link();
	link.setPosition( 1, 0, 0 );

	root.addChild( rootLink );
	rootLink.addChild( joint );
	joint.addChild( link );

	const goal = new Goal();
	goal.setGoalDoF( DOF.X, DOF.Y, DOF.Z );
	goal.makeClosure( link );

	return { root, joint, goal };

}

describe( 'Solver', () => {

	it( 'should stall when the chain has no free degrees of freedom.', () => {

		const { root, goal } = createChain();
		goal.setPosition( 0, 1, 0 );

		const solver = new Solver( [ root, goal ] );
		const results = solver.solve();

		expect( results ).toEqual( [ SOLVE_STATUS.STALLED ] );

	} );

	it( 'should stall when every free degree of freedom is locked by a joint limit.', () => {

		const { root, joint, goal } = createChain();
		joint.setDoF( DOF.EZ );
		joint.setMinLimits( - 0.05 );
		joint.setMaxLimits( 0.05 );
		goal.setPosition( 0, 1, 0 );

		const solver = new Solver( [ root, goal ] );
		solver.maxIterations = 10;
		const results = solver.solve();

		expect( results ).toEqual( [ SOLVE_STATUS.STALLED ] );
		expect( joint.getDoFValue( DOF.EZ ) ).toBeCloseTo( 0.05 );

	} );

	it( 'should solve with SVD when there are more free DoF than constraints.', () => {

		// three link planar arm with a two row goal: the jacobian is 2 x 3
		const root = new Joint();
		const rootLink = new Link();
		root.addChild( rootLink );

		let parent = rootLink;
		for ( let i = 0; i < 3; i ++ ) {

			const joint = new Joint();
			joint.setDoF( DOF.EZ );
			const link = new Link();
			link.setPosition( 1, 0, 0 );
			parent.addChild( joint );
			joint.addChild( link );
			parent = link;

		}

		const goal = new Goal();
		goal.setGoalDoF( DOF.X, DOF.Y );
		goal.setPosition( 1.5, 1.5, 0 );
		goal.makeClosure( parent );

		const svdSpy = vi.spyOn( mat, 'svd' );
		const solver = new Solver( [ root, goal ] );
		solver.useSVD = true;

		let status = - 1;
		for ( let i = 0; i < 50 && status !== SOLVE_STATUS.CONVERGED; i ++ ) {

			status = solver.solve()[ 0 ];

		}

		expect( status ).toBe( SOLVE_STATUS.CONVERGED );
		expect( svdSpy ).toHaveBeenCalled();
		expect( svdSpy.mock.results.every( r => r.type === 'return' ) ).toBe( true );
		svdSpy.mockRestore();

	} );

	it( 'should take a bounded step near a singularity without backtracking when using SVD.', () => {

		// nearly straight arm reaching for a goal beyond its length along the arm axis
		const root = new Joint();
		const rootLink = new Link();
		root.addChild( rootLink );
		const j1 = new Joint();
		j1.setDoF( DOF.EZ );
		j1.setDoFValues( 0.01 );
		const l1 = new Link();
		l1.setPosition( 1, 0, 0 );
		const j2 = new Joint();
		j2.setDoF( DOF.EZ );
		j2.setDoFValues( - 0.02 );
		const l2 = new Link();
		l2.setPosition( 1, 0, 0 );
		rootLink.addChild( j1 );
		j1.addChild( l1 );
		l1.addChild( j2 );
		j2.addChild( l2 );

		const goal = new Goal();
		goal.setGoalDoF( DOF.X, DOF.Y, DOF.Z );
		goal.setPosition( 3, 0, 0 );
		goal.makeClosure( l2 );

		const solver = new Solver( [ root, goal ] );
		solver.useSVD = true;
		solver.maxIterations = 0;

		const applySpy = vi.spyOn( ChainSolver.prototype, 'applyJointAngles' );
		const before = getClosureErrorMagnitude( goal );
		const status = solver.solve()[ 0 ];
		const after = getClosureErrorMagnitude( goal );

		expect( status ).not.toBe( SOLVE_STATUS.DIVERGED );
		expect( after ).toBeLessThanOrEqual( before + solver.divergeThreshold );
		expect( applySpy ).toHaveBeenCalledTimes( 1 );
		expect( Math.abs( j1.getDoFValue( DOF.EZ ) ) ).toBeLessThan( 0.5 );
		expect( Math.abs( j2.getDoFValue( DOF.EZ ) ) ).toBeLessThan( 0.5 );
		applySpy.mockRestore();

	} );

} );
