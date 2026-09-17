import { Joint, DOF } from '../../../src/core/Joint.js';
import { accumulateTargetError } from '../../../src/core/utils/solver.js';
import { mat } from '../../../src/core/utils/matrix.js';

function createSolver() {

	return {
		translationConvergeThreshold: 1e-3,
		rotationConvergeThreshold: 1e-5,
		translationErrorClamp: 0.1,
		rotationErrorClamp: 0.1,
		translationFactor: 1,
		rotationFactor: 1,
		lockedJointDoFCount: new Map(),
		lockedJointDoF: new Map(),
	};

}

describe( 'accumulateTargetError', () => {

	it( 'should fill the error vector with the clamped delta to the target.', () => {

		const joint = new Joint();
		joint.setDoF( DOF.X, DOF.EZ );
		joint.setDoFValues( 0, 0 );
		joint.setTargetValues( 1, - 1 );

		const errorVector = mat.create( 2, 1 );
		accumulateTargetError( createSolver(), joint, 0, errorVector, {} );

		expect( mat.get( errorVector, 0, 0 ) ).toBeCloseTo( 0.1 );
		expect( mat.get( errorVector, 1, 0 ) ).toBeCloseTo( - 0.1 );

	} );

	it( 'should not scale deltas that are within the error clamp.', () => {

		const joint = new Joint();
		joint.setDoF( DOF.X, DOF.EZ );
		joint.setDoFValues( 0, 0 );
		joint.setTargetValues( 0.05, 0 );

		const errorVector = mat.create( 2, 1 );
		accumulateTargetError( createSolver(), joint, 0, errorVector, {} );

		expect( mat.get( errorVector, 0, 0 ) ).toBeCloseTo( 0.05 );
		expect( mat.get( errorVector, 1, 0 ) ).toBe( 0 );

	} );

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
