import { quat } from 'gl-matrix';
import { getEuler } from '../../../src/core/utils/glmatrix.js';
import { smallestDifferenceQuaternion } from '../../../src/core/utils/quaternion.js';

describe( 'getEuler', () => {

	it( 'should return the equivalent euler angles', () => {

		for ( let i = 0; i < 100; i ++ ) {

			const euler = [
				( Math.random() - 0.5 ) * 360,
				( Math.random() - 0.5 ) * 360,
				( Math.random() - 0.5 ) * 360,
			];
			const outputEuler = new Array( 3 );
			const quaternion = new Array( 4 );

			quat.fromEuler( quaternion, euler[ 0 ], euler[ 1 ], euler[ 2 ] );
			getEuler( outputEuler, quaternion );

			const compareQuaternion = new Array( 4 );
			quat.fromEuler( compareQuaternion, outputEuler[ 0 ], outputEuler[ 1 ], outputEuler[ 2 ] );

			const delta = new Array( 4 );
			smallestDifferenceQuaternion( delta, quaternion, compareQuaternion );

			expect( Math.abs( delta[ 0 ] ) ).toBeLessThan( 1e-7 );
			expect( Math.abs( delta[ 1 ] ) ).toBeLessThan( 1e-7 );
			expect( Math.abs( delta[ 2 ] ) ).toBeLessThan( 1e-7 );
			expect( Math.abs( delta[ 3 ] ) ).toBeLessThan( 1e-7 );

		}

	} );

} )
