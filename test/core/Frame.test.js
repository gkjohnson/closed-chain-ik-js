import { quat } from 'gl-matrix';
import { Frame } from '../../src/core/Frame.js';
import { quaternionDistance } from '../../src/core/utils/quaternion.js';
import { PI, HALF_PI, RAD2DEG } from '../../src/core/utils/constants.js';

describe( 'Frame', () => {

	describe( 'setPosition', () => {

		it( 'should set the position of the frame.', () => {

			const frame = new Frame();
			frame.setPosition( 1, 2, 3 );
			expect( frame.position ).toEqual( new Float32Array( [ 1, 2, 3 ] ) );
			expect( frame.matrixNeedsUpdate ).toBeTruthy();

		} );

	} );

	describe( 'setEuler', () => {

		it( 'should set the quaternion of the frame.', () => {

			const frame = new Frame();
			frame.setEuler( 0, 0, PI );
			expect( frame.quaternion[ 0 ] ).toEqual( 0 );
			expect( frame.quaternion[ 1 ] ).toEqual( 0 );
			expect( frame.quaternion[ 2 ] ).toEqual( 1 );
			expect( frame.quaternion[ 3 ] ).toBeLessThan( 1e-7 );
			expect( frame.matrixNeedsUpdate ).toBeTruthy();

		} );

	} );

	describe( 'setQuaternion', () => {

		it( 'should set the quaternion of the frame.', () => {

			const frame = new Frame();
			frame.setQuaternion( 1, 0, 0, 0 );
			expect( frame.quaternion ).toEqual( new Float32Array( [ 1, 0, 0, 0 ] ) );
			expect( frame.matrixNeedsUpdate ).toBeTruthy();

		} );

	} );

	describe( 'setWorldPosition', () => {

		it( 'should just set the position if there is no parent.', () => {

			const f = new Frame();
			f.setWorldPosition( 1, 2, 3 );

			expect( f.matrixNeedsUpdate ).toBeTruthy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( f.position ).toEqual( new Float32Array( [ 1, 2, 3 ] ) );

		} );

		it( 'should be set relative to its parent transform.', () => {

			const p = new Frame();
			const f = new Frame();
			p.addChild( f );

			p.setPosition( 0, 1, 0 );
			p.setEuler( 0, HALF_PI, 0 );

			f.setWorldPosition( 1, 1, 0 );

			expect( f.matrixNeedsUpdate ).toBeTruthy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( f.position[ 0 ] ).toBeLessThan( 1e-7 );
			expect( f.position[ 1 ] ).toBeLessThan( 1e-7 );
			expect( Math.abs( 1.0 - f.position[ 2 ] ) ).toBeLessThan( 1e-6 );

		} );

	} );

	describe( 'setWorldEuler', () => {

		it( 'should just set the quaternion if there is no parent.', () => {

			const f = new Frame();
			f.setWorldEuler( HALF_PI, HALF_PI, 0 );

			const quaternion = new Float32Array( 4 );
			quat.fromEuler( quaternion, HALF_PI * RAD2DEG, HALF_PI * RAD2DEG, 0 );

			expect( f.matrixNeedsUpdate ).toBeTruthy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( quaternionDistance( f.quaternion, quaternion ) ).toEqual( 0 );

		} );

		it( 'should take the inverse of the parents rotation if set to identity.', () => {

			const p = new Frame();
			const f = new Frame();
			p.addChild( f );

			p.setEuler( HALF_PI, HALF_PI, 0 );
			f.setWorldQuaternion( 0, 0, 0, 1 );

			expect( f.matrixNeedsUpdate ).toBeTruthy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();

			const invertParentQuat = new Float32Array( 4 );
			quat.invert( invertParentQuat, p.quaternion );

			expect( f.quaternion ).toEqual( invertParentQuat );

		} );

	} );

	describe( 'setWorldQuaternion', () => {

		it( 'should just set the quaternion if there is no parent.', () => {

			const f = new Frame();
			f.setWorldQuaternion( 0, 0, 1, 0 );

			expect( f.matrixNeedsUpdate ).toBeTruthy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( f.quaternion ).toEqual( new Float32Array( [ 0, 0, 1, 0 ] ) );

		} );

		it( 'should take the inverse of the parents rotation if set to identity.', () => {

			const p = new Frame();
			const f = new Frame();
			p.addChild( f );

			p.setEuler( 0, HALF_PI, 0 );
			f.setWorldQuaternion( 0, 0, 0, 1 );

			expect( f.matrixNeedsUpdate ).toBeTruthy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();

			const invertParentQuat = new Float32Array( 4 );
			invertParentQuat[ 0 ] = 0;
			invertParentQuat[ 1 ] = - p.quaternion[ 1 ];
			invertParentQuat[ 2 ] = 0;
			invertParentQuat[ 3 ] = p.quaternion[ 3 ];

			expect( f.quaternion ).toEqual( invertParentQuat );

		} );

	} );

	describe( 'travesreParents', () => {

		it( 'should traverse all parents in order.', () => {

			const f1 = new Frame();
			f1.name = 'f1';

			const c1 = new Frame();
			c1.name = 'c1';

			const c2 = new Frame();
			c2.name = 'c2';

			const c12 = new Frame();
			c12.name = 'c12';

			f1.addChild( c1 );
			f1.addChild( c2 );
			c1.addChild( c12 );

			const results = [];
			c12.traverseParents( c => {

				results.push( c );

			} );

			expect( results.map( f => f.name ) ).toEqual( [ 'c1', 'f1' ] );

		} );

		it( 'should be able to be called in a tested way.', () => {

			const f1 = new Frame();
			f1.name = 'f1';

			const c1 = new Frame();
			c1.name = 'c1';

			const c2 = new Frame();
			c2.name = 'c2';

			const c12 = new Frame();
			c12.name = 'c12';

			f1.addChild( c1 );
			f1.addChild( c2 );
			c1.addChild( c12 );

			const results = [];
			c12.traverseParents( c => {

				results.push( c );

				const results2 = [];
				c12.traverseParents( c2 => {

					results2.push( c2 );

				} );

				expect( results2.map( f => f.name ) ).toEqual( [ 'c1', 'f1' ] );

			} );

			expect( results.map( f => f.name ) ).toEqual( [ 'c1', 'f1' ] );

		} );



	} );

	describe( 'traverse', () => {

		it( 'should traverse all children in breadth first order.', () => {

			const f1 = new Frame();
			f1.name = 'f1';

			const c1 = new Frame();
			c1.name = 'c1';

			const c2 = new Frame();
			c2.name = 'c2';

			const c12 = new Frame();
			c12.name = 'c12';

			f1.addChild( c1 );
			f1.addChild( c2 );
			c1.addChild( c12 );

			const results = [];
			f1.traverse( c => {

				results.push( c );

			} );

			expect( results.map( f => f.name ) ).toEqual( [ 'f1', 'c1', 'c2', 'c12' ] );

		} );

		it( 'should be able to be called in a nested way.', () => {

			const f1 = new Frame();
			f1.name = 'f1';

			const c1 = new Frame();
			c1.name = 'c1';

			const c2 = new Frame();
			c2.name = 'c2';

			const c12 = new Frame();
			c12.name = 'c12';

			f1.addChild( c1 );
			f1.addChild( c2 );
			c1.addChild( c12 );

			const results = [];
			f1.traverse( c => {

				results.push( c );

				const results2 = [];
				f1.traverse( c2 => {

					results2.push( c2 );

				} );
				expect( results2.map( f => f.name ) ).toEqual( [ 'f1', 'c1', 'c2', 'c12' ] );

			} );

			expect( results.map( f => f.name ) ).toEqual( [ 'f1', 'c1', 'c2', 'c12' ] );

		} );

	} );

	describe( 'addChild, removeChild', () => {

		it( 'should not be able to add itself as a child.', () => {

			const f = new Frame();
			let caught = false;
			try {

				f.addChild( f );
				throw new Error();

			} catch {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

		it( 'should add and remove the given frame as a child and marks world matrix as dirty.', () => {

			const f1 = new Frame();
			const c1 = new Frame();
			c1.name = 'c1';

			const c2 = new Frame();
			c2.name = 'c2';

			const c3 = new Frame();
			c3.name = 'c3';

			expect( c1.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( c1.matrixNeedsUpdate ).toBeFalsy();
			expect( c2.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( c2.matrixNeedsUpdate ).toBeFalsy();
			expect( c3.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( c3.matrixNeedsUpdate ).toBeFalsy();
			expect( f1.children.map( f => f.name ) ).toEqual( [] );

			f1.addChild( c1 );
			expect( f1.children.map( f => f.name ) ).toEqual( [ 'c1' ] );
			expect( c1.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c1.matrixNeedsUpdate ).toBeFalsy();

			f1.addChild( c2 );
			expect( f1.children.map( f => f.name ) ).toEqual( [ 'c1', 'c2' ] );
			expect( c2.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c2.matrixNeedsUpdate ).toBeFalsy();

			f1.addChild( c3 );
			expect( f1.children.map( f => f.name ) ).toEqual( [ 'c1', 'c2', 'c3' ] );
			expect( c3.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c3.matrixNeedsUpdate ).toBeFalsy();

			c1.updateMatrixWorld();
			c2.updateMatrixWorld();
			c3.updateMatrixWorld();

			f1.removeChild( c2 );
			expect( f1.children.map( f => f.name ) ).toEqual( [ 'c1', 'c3' ] );
			expect( c2.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c2.matrixNeedsUpdate ).toBeFalsy();

			f1.removeChild( c1 );
			expect( f1.children.map( f => f.name ) ).toEqual( [ 'c3' ] );
			expect( c1.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c1.matrixNeedsUpdate ).toBeFalsy();

			f1.removeChild( c3 );
			expect( f1.children.map( f => f.name ) ).toEqual( [] );
			expect( c3.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c3.matrixNeedsUpdate ).toBeFalsy();

		} );

	} );

	describe( 'attachChild / detachChild', () => {

		it( 'should retain the childs world position.', () => {

			const f = new Frame();
			const c = new Frame();

			f.setPosition( 1, 2, 3 );
			c.setPosition( 2, 4, 6 );

			f.attachChild( c );
			expect( c.position ).toEqual( new Float32Array( [ 1, 2, 3 ] ) );

			f.detachChild( c );
			expect( c.position ).toEqual( new Float32Array( [ 2, 4, 6 ] ) );

		} );

		it( 'should retain the childs world rotation.', () => {

			const f = new Frame();
			const c = new Frame();

			f.setQuaternion( 1, 0, 0, 0 );
			c.setQuaternion( 0, 1, 0, 0 );

			f.attachChild( c );
			expect( c.quaternion ).toEqual( new Float32Array( [ 0, 0, 1, 0 ] ) );

			f.detachChild( c );
			expect( c.quaternion ).toEqual( new Float32Array( [ 0, 1, 0, 0 ] ) );

		} );

		it( 'should return the childs world matrix.', () => {

			const f = new Frame();
			const c = new Frame();

			f.setQuaternion( 1, 0, 0, 0 );
			f.setPosition( 1, 2, 3 );

			c.setQuaternion( 0, 1, 0, 0 );
			c.setPosition( 2, 4, 6 );
			c.updateMatrixWorld();

			const ogMatrixWorld = c.matrixWorld.slice();

			f.attachChild( c );
			f.updateMatrixWorld( true );
			expect( ogMatrixWorld ).toEqual( c.matrixWorld );

			f.detachChild( c );
			c.updateMatrixWorld();
			expect( ogMatrixWorld ).toEqual( c.matrixWorld );

		} );

	} );

	describe( 'updateMatrix', () => {

		it( 'should should mark matrix world needs update to true only if matrix was updated.', () => {

			const f = new Frame();
			expect( f.matrixNeedsUpdate ).toBeFalsy();
			expect( f.matrixWorldNeedsUpdate ).toBeFalsy();

			f.updateMatrix();
			expect( f.matrixNeedsUpdate ).toBeFalsy();
			expect( f.matrixWorldNeedsUpdate ).toBeFalsy();

			f.setPosition( 1, 2, 3 );
			f.updateMatrix();

			expect( f.matrixNeedsUpdate ).toBeFalsy();
			expect( f.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( f.matrix ).toEqual( new Float32Array( [
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				1, 2, 3, 1,
			] ) );

		} );

	} );

	describe( 'updateMatrixWorld', () => {

		it( 'should automatically update the matrix if needed.', () => {

			const f = new Frame();
			f.setPosition( 1, 2, 3 );
			f.updateMatrixWorld();

			expect( f.matrixNeedsUpdate ).toBeFalsy();
			expect( f.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( f.matrixWorld ).toEqual( new Float32Array( [
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				1, 2, 3, 1,
			] ) );

		} );

		it( 'should mark child world matrices as dirty when updating.', () => {

			const f = new Frame();
			const c1 = new Frame();
			const c2 = new Frame();

			f.addChild( c1 );
			c1.addChild( c2 );

			c1.updateMatrixWorld();
			c2.updateMatrixWorld();

			f.updateMatrixWorld();
			expect( c1.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( c2.matrixWorldNeedsUpdate ).toBeFalsy();

			f.setPosition( 1, 2, 3 );
			f.updateMatrixWorld();
			expect( c1.matrixWorldNeedsUpdate ).toBeTruthy();
			expect( c2.matrixWorldNeedsUpdate ).toBeTruthy();

		} );

		it( 'should update all child transforms if true is passed in.', () => {

			const f = new Frame();
			const c1 = new Frame();
			const c2 = new Frame();

			f.addChild( c1 );
			c1.addChild( c2 );

			c1.updateMatrixWorld();
			c2.updateMatrixWorld();

			c2.setPosition( 1, 2, 3 );

			f.updateMatrixWorld();
			expect( c2.matrixNeedsUpdate ).toBeTruthy();
			expect( c2.matrixWorldNeedsUpdate ).toBeTruthy();

			f.updateMatrixWorld( true );
			expect( c2.matrixNeedsUpdate ).toBeFalsy();
			expect( c2.matrixWorldNeedsUpdate ).toBeFalsy();

			f.setPosition( 1, 2, 3 );
			f.updateMatrixWorld( true );
			expect( c1.matrixNeedsUpdate ).toBeFalsy();
			expect( c1.matrixWorldNeedsUpdate ).toBeFalsy();
			expect( c2.matrixNeedsUpdate ).toBeFalsy();
			expect( c2.matrixWorldNeedsUpdate ).toBeFalsy();

			expect( c1.matrixWorld ).toEqual( new Float32Array( [
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				1, 2, 3, 1,
			] ) );

			expect( c2.matrixWorld ).toEqual( new Float32Array( [
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				2, 4, 6, 1,
			] ) );

		} );

		it( 'should automatically update all parents up the chain.', () => {

			const f = new Frame();
			const c1 = new Frame();
			const c2 = new Frame();

			f.addChild( c1 );
			c1.addChild( c2 );
			f.updateMatrixWorld( true );

			f.setPosition( 1, 2, 3 );
			expect( f.matrixNeedsUpdate ).toBeTruthy();

			c2.updateMatrixWorld();
			expect( f.matrixNeedsUpdate ).toBeFalsy();

		} );

	} );

} );
