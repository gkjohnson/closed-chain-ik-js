import { mat } from '../../../src/core/utils/matrix.js';

// decompose the matrix and return u * q * v^T
function reconstruct( matrix ) {

	const rows = matrix.length;
	const cols = matrix[ 0 ].length;
	const k = Math.min( rows, cols );

	const u = mat.create( rows, k );
	const q = mat.create( k, k );
	const v = mat.create( cols, k );
	mat.svd( u, q, v, matrix );

	const vt = mat.create( k, cols );
	const uq = mat.create( rows, k );
	const result = mat.create( rows, cols );
	mat.transpose( vt, v );
	mat.multiply( uq, u, q );
	mat.multiply( result, uq, vt );
	return result;

}

function flatten( matrix ) {

	const result = [];
	for ( let r = 0; r < matrix.length; r ++ ) {

		result.push( ...matrix[ r ] );

	}

	return result;

}

function closeTo( matrix ) {

	return flatten( matrix ).map( v => expect.closeTo( v, 10 ) );

}

describe( 'mat.svd', () => {

	it( 'should decompose a tall matrix.', () => {

		const matrix = mat.create( 3, 2 );
		matrix[ 0 ].set( [ 1, 2 ] );
		matrix[ 1 ].set( [ 3, 4 ] );
		matrix[ 2 ].set( [ 5, 6 ] );
		expect( flatten( reconstruct( matrix ) ) ).toEqual( closeTo( matrix ) );

	} );

	it( 'should decompose a wide matrix.', () => {

		const matrix = mat.create( 2, 3 );
		matrix[ 0 ].set( [ 1, 2, 3 ] );
		matrix[ 1 ].set( [ 4, 5, 6 ] );
		expect( flatten( reconstruct( matrix ) ) ).toEqual( closeTo( matrix ) );

	} );

} );
