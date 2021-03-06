import { Link } from '../../src/core/Link.js';
import { Joint, DOF } from '../../src/core/Joint.js';
import { findRoots } from '../../src/core/utils/findRoots.js';

describe( 'Joint', () => {

	describe( 'clearDoF', () => {

		it( 'should clear all DoF', () => {

			const joint = new Joint();
			joint.setDoF( DOF.X, DOF.Z, DOF.EX );

			expect( joint.dof ).toEqual( [ DOF.X, DOF.Z, DOF.EX ] );
			expect( joint.dofFlags ).toEqual( new Uint8Array( [ 1, 0, 1, 1, 0, 0 ] ) );
			expect( joint.translationDoFCount ).toEqual( 2 );
			expect( joint.rotationDoFCount ).toEqual( 1 );

			joint.clearDoF();

			expect( joint.dof ).toEqual( [] );
			expect( joint.dofFlags ).toEqual( new Uint8Array( [ 0, 0, 0, 0, 0, 0 ] ) );
			expect( joint.translationDoFCount ).toEqual( 0 );
			expect( joint.rotationDoFCount ).toEqual( 0 );

		} );

	} );

	describe( 'setDoF', () => {

		it( 'should set the degrees of freedom values.', () => {

			const joint = new Joint();
			joint.setDoF( DOF.X, DOF.Z, DOF.EX );

			expect( joint.dof ).toEqual( [ DOF.X, DOF.Z, DOF.EX ] );
			expect( joint.dofFlags ).toEqual( new Uint8Array( [ 1, 0, 1, 1, 0, 0 ] ) );
			expect( joint.translationDoFCount ).toEqual( 2 );
			expect( joint.rotationDoFCount ).toEqual( 1 );

		} );

		it( 'should reset DoF values.', () => {

			const joint = new Joint();
			joint.setDoF( DOF.X, DOF.Z, DOF.EX );

			joint.setMinLimits( 1, 2, 3 );
			joint.setMaxLimits( 2, 4, 6 );
			joint.setTargetValues( 2, 4, 6 );
			joint.setRestPoseValues( 2, 4, 6 );
			joint.setDoFValues( 1, 2, 3 );

			expect( joint.minDoFLimit ).toEqual( new Float32Array( [ 1, - Infinity, 2, 3, - Infinity, - Infinity ] ) );
			expect( joint.maxDoFLimit ).toEqual( new Float32Array( [ 2, Infinity, 4, 6, Infinity, Infinity ] ) );
			expect( joint.dofTarget ).toEqual( new Float32Array( [ 2, 0, 4, 6, 0, 0 ] ) );
			expect( joint.dofRestPose ).toEqual( new Float32Array( [ 2, 0, 4, 6, 0, 0 ] ) );
			expect( joint.dofValues ).toEqual( new Float32Array( [ 1, 0, 2, 3, 0, 0 ] ) );

			joint.setDoF( DOF.X, DOF.Z, DOF.EX );

			expect( joint.minDoFLimit ).toEqual( new Float32Array( 6 ).fill( - Infinity ) );
			expect( joint.maxDoFLimit ).toEqual( new Float32Array( 6 ).fill( Infinity ) );
			expect( joint.dofTarget ).toEqual( new Float32Array( [ 0, 0, 0, 0, 0, 0 ] ) );
			expect( joint.dofRestPose ).toEqual( new Float32Array( [ 0, 0, 0, 0, 0, 0 ] ) );
			expect( joint.dofValues ).toEqual( new Float32Array( [ 0, 0, 0, 0, 0, 0 ] ) );

		} );

	} );

	describe( 'setMatrixDoFNeedsUpdate', () => {

		it( 'should mark the joint as needing a dof matrix and world matrix update.', () => {

			const joint = new Joint();
			const child = new Link();
			joint.addChild( child );

			joint.updateMatrixWorld( true );

			expect( joint.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( joint.matrixDoFNeedsUpdate ).toBeFalsy();
			expect( joint.matrixNeedsUpdate ).toBeFalsy();

			expect( child.matrixWorldNeedsUpdate ).toBeFalsy();

			joint.setMatrixDoFNeedsUpdate();

			expect( joint.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( joint.matrixDoFNeedsUpdate ).toBeTruthy();
			expect( joint.matrixNeedsUpdate ).toBeFalsy();

			expect( child.matrixWorldNeedsUpdate ).toBeTruthy();

			joint.updateDoFMatrix();

			expect( joint.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( joint.matrixDoFNeedsUpdate ).toBeFalsy();
			expect( joint.matrixNeedsUpdate ).toBeFalsy();

			expect( child.matrixWorldNeedsUpdate ).toBeTruthy();

		} );

		it( 'should get the dof matrix updated when calling updateMatrixWorld', () => {

			const joint = new Joint();

			joint.updateMatrixWorld();
			joint.setMatrixDoFNeedsUpdate();

			expect( joint.matrixDoFNeedsUpdate ).toBeTruthy();

			joint.updateMatrixWorld();

			expect( joint.matrixDoFNeedsUpdate ).toBeFalsy();

		} );

	} );

	describe( 'addChild', () => {

		it( 'should only allow adding links.', () => {

			const joint = new Joint();
			const joint2 = new Joint();

			let caught;
			caught = false;
			try {

				joint.addChild( joint2 );

			} catch ( e ) {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

		it( 'should only allow adding one child.', () => {

			const joint = new Joint();
			const child = new Link();
			const child2 = new Link();
			joint.addChild( child );

			let caught;
			caught = false;
			try {

				joint.addChild( child2 );

			} catch ( e ) {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

		it( 'should throw if the joint is already a closure.', () => {

			const joint = new Joint();
			const child = new Link();
			const child2 = new Link();
			joint.makeClosure( child );

			let caught;
			caught = false;
			try {

				joint.addChild( child2 );

			} catch ( e ) {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

		it( 'should set the child field.', () => {

			const joint = new Joint();
			const child = new Link();

			expect( joint.child ).toEqual( null );
			joint.addChild( child );
			expect( joint.child ).toEqual( child );

		} );

	} );

	describe( 'makeClosure', () => {

		it( 'should set child and isClosure.', () => {

			const joint = new Joint();
			const child = new Link();

			expect( joint.isClosure ).toEqual( false );
			expect( joint.child ).toEqual( null );

			joint.makeClosure( child );

			expect( joint.isClosure ).toEqual( true );
			expect( joint.child ).toEqual( child );
			expect( child.closureJoints ).toEqual( [ joint ] );

		} );

		it( 'should throw if called with a non link.', () => {

			const joint = new Joint();
			const joint2 = new Joint();

			let caught;
			caught = false;
			try {

				joint.makeClosure( joint2 );

			} catch ( e ) {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

		it( 'should throw if the joint already has a child.', () => {

			const joint = new Joint();
			const child = new Link();
			const child2 = new Link();

			joint.addChild( child );
			expect( joint.isClosure ).toEqual( false );

			let caught;
			caught = false;
			try {

				joint.makeClosure( child2 );

			} catch ( e ) {

				caught = true;

			}

			expect( child.closureJoints ).toEqual( [] );
			expect( caught ).toBeTruthy();

		} );

	} );

	describe( 'removeChild', () => {

		it( 'should remove the closure child.', () => {

			const joint = new Joint();
			const child = new Link();

			joint.makeClosure( child );
			expect( child.closureJoints ).toEqual( [ joint ] );

			joint.removeChild( child );

			expect( joint.isClosure ).toEqual( false );
			expect( joint.child ).toEqual( null );
			expect( child.closureJoints ).toEqual( [] );

		} );

		it( 'should throw if the child is not the closure child.', () => {

			const joint = new Joint();
			const child = new Link();
			const child2 = new Link();

			joint.makeClosure( child );

			let caught = false;
			try {

				joint.removeChild( child2 );

			} catch ( e ) {

				caught = true;

			}

			expect( child.closureJoints ).toEqual( [ joint ] );
			expect( caught ).toBeTruthy();

		} );

	} );

	describe( 'findRoots', () => {

		it( 'should find roots of connected closure joints.', () => {

			const joint = new Joint();
			const parent = new Link();
			const closureChild = new Link();

			const joint2 = new Joint();
			const closureChild2 = new Link();

			parent.addChild( joint );
			joint.makeClosure( closureChild );

			closureChild.addChild( joint2 );
			joint2.makeClosure( closureChild2 );

			const roots = findRoots( [ parent ] );
			expect( roots ).toEqual( [ parent, closureChild, closureChild2 ] );

			const roots2 = findRoots( [ closureChild ] );
			expect( roots2 ).toEqual( [ closureChild, parent, closureChild2 ] );

		} );

	} );

	describe( 'getDeltaWorldMatrix', () => {

		it.todo( 'should describe an offset world matrix based on the give DoF.' );
		it.todo( 'should return true if the delta was inverted due to a joint limit.' );

	} );

	describe( 'getClosureError', () => {

		it.todo( 'should throw if not a closure.' );
		it.todo( 'should return the delta pos and quat between the joint and closure link.' );

	} );

	describe( 'updateMatrixDoF', () => {

		it.todo( 'should update matrixDoF correctly based on the dofValues.' );

	} );

	describe( 'attachChild', () => {

		it.todo( 'should account for the DoF matrix when updating the world transform.' );

	} );

	describe( 'detachChild', () => {

		it.todo( 'should account for the DoF matrix when updating the world transform.' );

	} );

} );
