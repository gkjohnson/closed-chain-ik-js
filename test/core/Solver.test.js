import { Joint, DOF } from '../../src/core/Joint.js';
import { Link } from '../../src/core/Link.js';
import { Goal } from '../../src/core/Goal.js';
import { Solver } from '../../src/core/Solver.js';
import { SOLVE_STATUS } from '../../src/core/ChainSolver.js';
import { mat } from '../../src/core/utils/matrix.js';

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

} );
