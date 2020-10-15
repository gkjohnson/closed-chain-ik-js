import { smallestDifferenceQuaternion } from '../../../src/core/utils/quaternion.js';

describe( 'smallestDifferenceQuaternion', () => {

	it( 'should yield the smallest difference of equivalent quaternions.', () => {

		const output = new Array( 4 );

		smallestDifferenceQuaternion( output, [ 1, 1, 1, 1 ], [ - 1, - 1, - 1, -1 ] );
		expect( output ).toEqual( [ 0, 0, 0, 0 ] );

		smallestDifferenceQuaternion( output, [ 0, 0, 1, 0 ], [ 0, 0, 0, -1 ] );
		expect( output ).toEqual( [ 0, 0, 1, 1 ] );

	} );

} );
