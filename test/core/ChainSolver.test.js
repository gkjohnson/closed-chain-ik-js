import { Joint, DOF } from '../../src/core/Joint.js';
import { Link } from '../../src/core/Link.js';
import { Solver } from '../../src/core/Solver.js';
import { mat } from '../../src/core/utils/matrix.js';

const FD_STEP = 1e-4;

// Fill the analytic jacobian for the first chain of the solver.
function getAnalyticJacobian( solver ) {

	const chainSolver = solver.solvers[ 0 ];
	Object.assign( chainSolver, {
		matrixPool: solver.matrixPool,
		translationConvergeThreshold: solver.translationConvergeThreshold,
		rotationConvergeThreshold: solver.rotationConvergeThreshold,
		translationErrorClamp: solver.translationErrorClamp,
		rotationErrorClamp: solver.rotationErrorClamp,
		translationFactor: solver.translationFactor,
		rotationFactor: solver.rotationFactor,
	} );

	chainSolver.chain.forEach( j => j.updateMatrixWorld() );

	const info = { errorRows: 0, freeDoF: 0, totalError: 0 };
	const freeJoints = [];
	const targetJoints = [];
	chainSolver.countUnconvergedVariables( freeJoints, targetJoints, info );

	const jacobian = mat.create( info.errorRows, info.freeDoF );
	chainSolver.fillJacobian( targetJoints, freeJoints, jacobian );
	return { jacobian, freeJoints, chain: chainSolver.chain };

}

// Finite difference of the negated closure error with respect to each free single dof joint.
function getFiniteDifferenceJacobian( closure, freeJoints, chain ) {

	const error = out => {

		chain.forEach( j => j.updateMatrixWorld() );
		const pos = new Float64Array( 3 );
		const rot = new Float64Array( 3 );
		closure.getClosureError( pos, rot );
		out.set( pos, 0 );
		out.set( rot, 3 );

	};

	const e0 = new Float64Array( 6 );
	const e1 = new Float64Array( 6 );
	const jacobian = mat.create( 6, freeJoints.length );
	freeJoints.forEach( ( joint, col ) => {

		const dof = joint.dof[ 0 ];
		const value = joint.getDoFValue( dof );
		error( e0 );
		joint.setDoFValue( dof, value + FD_STEP );
		error( e1 );
		joint.setDoFValue( dof, value );

		for ( let row = 0; row < 6; row ++ ) {

			mat.set( jacobian, row, col, - ( e1[ row ] - e0[ row ] ) / FD_STEP );

		}

	} );

	return jacobian;

}

describe( 'ChainSolver', () => {

	describe( 'fillJacobian', () => {

		it( 'should match finite differences for joints above the closure fork.', () => {

			// root(EZ) -> base -> j1(EZ) -> l1 -> j2(EZ) -> l2 and jc(EZ) on base closing onto l2
			const root = new Joint();
			root.setDoF( DOF.EZ );
			const base = new Link();
			root.addChild( base );

			const j1 = new Joint();
			j1.setDoF( DOF.EZ );
			const l1 = new Link();
			l1.setPosition( 1, 0, 0 );
			const j2 = new Joint();
			j2.setDoF( DOF.EZ );
			const l2 = new Link();
			l2.setPosition( 1, 0, 0 );
			base.addChild( j1 );
			j1.addChild( l1 );
			l1.addChild( j2 );
			j2.addChild( l2 );

			const jc = new Joint();
			jc.setDoF( DOF.EZ );
			jc.setPosition( 2, 0.3, 0 );
			base.addChild( jc );
			jc.makeClosure( l2 );

			const solver = new Solver( [ root ] );
			const { jacobian, freeJoints, chain } = getAnalyticJacobian( solver );
			const expected = getFiniteDifferenceJacobian( jc, freeJoints, chain );

			expect( freeJoints ).toContain( root );
			for ( let row = 0; row < 6; row ++ ) {

				for ( let col = 0; col < freeJoints.length; col ++ ) {

					expect( mat.get( jacobian, row, col ) ).toBeCloseTo( mat.get( expected, row, col ), 2 );

				}

			}

		} );

	} );

} );
