import linearSolve from 'linear-solve';
import { SVD } from 'svd-js';

function transpose( outMatrix, a ) {

	const tr = a.length;
	const tc = a[ 0 ].length;

	for ( let r = 0; r < tr; r ++ ) {

		for ( let c = 0; c < tc; c ++ ) {

			outMatrix[ c ][ r ] = a[ r ][ c ];

		}

	}

}

function identity( outMatrix ) {

	for ( let r = 0, tr = outMatrix.length; r < tr; r ++ ) {

		for ( let c = 0, tc = outMatrix.length; c < tc; c ++ ) {

			outMatrix[ r ][ c ] = r === c ? 1 : 0;

		}

	}

}

function scale( outMatrix, matrix, scalar ) {

	for ( let r = 0, tr = outMatrix.length; r < tr; r ++ ) {

		for ( let c = 0, tc = outMatrix.length; c < tc; c ++ ) {

			outMatrix[ r ][ c ] = matrix[ r ][ c ] * scalar;

		}

	}

}

function multiply( outMatrix, a, b ) {

	if ( a === outMatrix || b === outMatrix ) {

		throw new Error( 'Matrix: Cannot multiply to a matrix in place.' );

	}

	// a is m x n
	// b is n x k
	// outMatrix is m x k

	// m = a rows
	// n = a cols or b rows
	// k = b cols

	const m = a.length;
	const n = b.length;
	const k = b[ 0 ].length;

	// iterate over m
	for ( let r = 0, tr = m; r < tr; r ++ ) {

		// iterate over k
		for ( let c = 0, tc = k; c < tc; c ++ ) {

			let sum = 0;

			// iterate over n
			for ( let i = 0, ti = n; i < ti; i ++ ) {

				sum += a[ r ][ i ] * b[ i ][ c ];

			}

			outMatrix[ r ][ c ] = sum;

		}

	}

}

function create( row, col ) {

	const result = new Array( row );
	for ( let i = 0; i < row; i ++ ) {

		result[ i ] = new Float64Array( col );

	}

	return result;

}

function copy( outMatrix, sourceMatrix ) {

	const tr = sourceMatrix.length;
	const tc = sourceMatrix[ 0 ].length;
	for ( let r = 0; r < tr; r ++ ) {

		for ( let c = 0; c < tc; c ++ ) {

			outMatrix[ r ][ c ] = sourceMatrix[ r ][ c ];

		}

	}

}

function clone( matrix ) {

	const rows = matrix.length;
	const cols = matrix[ 0 ].length;
	const resultMatrix = create( rows, cols );
	copy( resultMatrix, matrix );
	return resultMatrix;

}

function solve( outMatrix, matrix, vector ) {

	const res = linearSolve.solve( matrix, vector );
	for ( let i = 0, l = res.length; i < l; i ++ ) {

		outMatrix[ i ].set( res[ i ] );

	}

}

function svd( ru, rq, rv, matrix ) {

	const { u, v, q } = SVD( matrix );

	const urows = u.length;
	for ( let r = 0; r < urows; r ++ ) {

		ru[ r ].set( u[ r ] );

	}

	const vrows = v.length;
	for ( let r = 0; r < vrows; r ++ ) {

		rv[ r ].set( v[ r ] );

	}

	const qrows = q.length;
	for ( let r = 0; r < qrows; r ++ ) {

		const rqrow = rq[ r ];
		const qval = q[ r ];
		rqrow.fill( 0 );
		rqrow[ r ] = qval;

	}

}

function invert( outMatrix, matrix ) {

	const res = linearSolve.invert( matrix );

	const tr = matrix[ 0 ].length;
	const tc = matrix.length;
	for ( let r = 0; r < tr; r ++ ) {

		for ( let c = 0; c < tc; c ++ ) {

			outMatrix[ r ][ c ] = res[ r ][ c ];

		}

	}

}

function add( outMatrix, a, b ) {

	const tr = a.length;
	const tc = a[ 0 ].length;
	for ( let r = 0; r < tr; r ++ ) {

		for ( let c = 0; c < tc; c ++ ) {

			outMatrix[ r ][ c ] = a[ r ][ c ] + b[ r ][ c ];

		}

	}

}

function subtract( outMatrix, a, b ) {

	const tr = a.length;
	const tc = a[ 0 ].length;
	for ( let r = 0; r < tr; r ++ ) {

		for ( let c = 0; c < tc; c ++ ) {

			outMatrix[ r ][ c ] = a[ r ][ c ] - b[ r ][ c ];

		}

	}

}

function magnitudeSquared( matrix ) {

	let sum = 0;
	const rows = matrix.length;
	const cols = matrix[ 0 ].length;
	for ( let r = 0; r < rows; r ++ ) {

		for ( let c = 0; c < cols; c ++ ) {

			sum += matrix[ r ][ c ] ** 2;

		}

	}

	return sum;

}

function magnitude( matrix ) {

	return Math.sqrt( magnitudeSquared( matrix ) );

}

function toString( matrix, dec = 3 ) {

	const rows = matrix.length;
	const cols = matrix[ 0 ].length;
	let str = '';
	for ( let r = 0; r < rows; r ++ ) {

		for ( let c = 0; c < cols; c ++ ) {

			str += matrix[ r ][ c ].toFixed( dec ) + ', ';

		}

		str += '\n';

	}

	return str;

}

function log( matrix, dec ) {

	console.log( toString( matrix, dec ) );

}

export const mat = {
	transpose,
	identity,
	scale,
	multiply,
	create,
	copy,
	clone,
	solve,
	svd,
	invert,
	add,
	subtract,
	magnitudeSquared,
	magnitude,
	toString,
	log,
};
