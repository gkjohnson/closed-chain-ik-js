import { Joint, DOF } from '../../src/core/Joint.js';
import { Link } from '../../src/core/Link.js';
import { Goal } from '../../src/core/Goal.js';
import { Solver } from '../../src/core/Solver.js';
import { SOLVE_STATUS } from '../../src/core/ChainSolver.js';

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

	it( 'should solve for a target joint value inside a chain.', () => {

		// two link planar arm: root -> j1 -> l1 -> j2 -> l2 with a goal on l2
		const root = new Joint();
		const rootLink = new Link();
		const j1 = new Joint();
		j1.setDoF( DOF.EZ );
		const l1 = new Link();
		l1.setPosition( 1, 0, 0 );
		const j2 = new Joint();
		j2.setDoF( DOF.EZ );
		const l2 = new Link();
		l2.setPosition( 1, 0, 0 );

		root.addChild( rootLink );
		rootLink.addChild( j1 );
		j1.addChild( l1 );
		l1.addChild( j2 );
		j2.addChild( l2 );

		// place the goal where the arm reaches when j1 = 0.5 and j2 = 0.3
		const goal = new Goal();
		goal.setGoalDoF( DOF.X, DOF.Y, DOF.Z );
		goal.setPosition( Math.cos( 0.5 ) + Math.cos( 0.8 ), Math.sin( 0.5 ) + Math.sin( 0.8 ), 0 );
		goal.makeClosure( l2 );

		j1.setTargetValues( 0.5 );
		j1.targetSet = true;

		const solver = new Solver( [ root, goal ] );
		let status = - 1;
		for ( let i = 0; i < 50 && status !== SOLVE_STATUS.CONVERGED; i ++ ) {

			status = solver.solve()[ 0 ];

		}

		expect( status ).toBe( SOLVE_STATUS.CONVERGED );
		expect( j1.getDoFValue( DOF.EZ ) ).toBeCloseTo( 0.5, 2 );
		expect( j2.getDoFValue( DOF.EZ ) ).toBeCloseTo( 0.3, 2 );

	} );

} );
