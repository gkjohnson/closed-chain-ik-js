import { Joint, DOF } from '../../../src/core/Joint.js';
import { accumulateTargetError } from '../../../src/core/utils/solver.js';

function createSolver() {

	return {
		translationConvergeThreshold: 1e-3,
		rotationConvergeThreshold: 1e-5,
		lockedJointDoFCount: new Map(),
		lockedJointDoF: new Map(),
	};

}

describe( 'accumulateTargetError', () => {

	it( 'should report converged when the joint is at its target.', () => {

		const joint = new Joint();
		joint.setDoF( DOF.EZ );
		joint.setDoFValues( 0.5 );
		joint.setTargetValues( 0.5 );

		const result = {};
		accumulateTargetError( createSolver(), joint, 0, null, result );
		expect( result.isConverged ).toBe( true );
		expect( result.totalError ).toBe( 0 );

	} );

	it( 'should not report converged when the target is below the current value.', () => {

		const joint = new Joint();
		joint.setDoF( DOF.EZ );
		joint.setDoFValues( 1 );
		joint.setTargetValues( 0 );

		const result = {};
		accumulateTargetError( createSolver(), joint, 0, null, result );
		expect( result.isConverged ).toBe( false );
		expect( result.totalError ).toBeCloseTo( 1 );

	} );

	it( 'should not let opposite rotation errors cancel out.', () => {

		const joint = new Joint();
		joint.setDoF( DOF.EX, DOF.EY );
		joint.setDoFValues( 0.5, - 0.5 );
		joint.setTargetValues( 0, 0 );

		const result = {};
		accumulateTargetError( createSolver(), joint, 0, null, result );
		expect( result.isConverged ).toBe( false );
		expect( result.totalError ).toBeCloseTo( 1 );

	} );

} );
