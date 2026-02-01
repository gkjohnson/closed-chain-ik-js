import { expect } from 'vitest';
import { quat } from 'gl-matrix';
import { smallestDifferenceQuaternion } from '../../src/core/utils/quaternion.js';
import { RAD2DEG } from '../../src/core/utils/constants.js';

expect.extend( {
	toEqualEuler( received, expected ) {


		const qa = new Array( 4 );
		const qb = new Array( 4 );
		const delta = new Array( 4 );

		quat.fromEuler( qa, received[ 0 ] * RAD2DEG, received[ 1 ] * RAD2DEG, received[ 2 ] * RAD2DEG );
		quat.fromEuler( qb, expected[ 0 ] * RAD2DEG, expected[ 1 ] * RAD2DEG, expected[ 2 ] * RAD2DEG );

		smallestDifferenceQuaternion( delta, qa, qb );

		const { isNot } = this;
		let pass = true;
		try {

			expect( Math.abs( delta[ 0 ] ) ).toBeLessThan( 1e-7 );
			expect( Math.abs( delta[ 1 ] ) ).toBeLessThan( 1e-7 );
			expect( Math.abs( delta[ 2 ] ) ).toBeLessThan( 1e-7 );
			expect( Math.abs( delta[ 3 ] ) ).toBeLessThan( 1e-7 );

		} catch {

			pass = false;

		}

		return {
			pass,
			message: () => {

				if ( isNot ) {

					return 'expected angles not to be equal';

				}

				return 'expected angles to be equal';

			},
		};

	},
} );
