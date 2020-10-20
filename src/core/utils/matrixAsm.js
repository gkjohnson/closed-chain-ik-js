// https://stackoverflow.com/questions/20822093/how-to-return-an-array-of-numbers-from-a-function-in-asm-js
export function mat( stdlib, foreign, heap ) {

	"use asm";

	var heap64 = new stdlib.Float64Array( heap );
	var imul = stdlib.Math.imul;
	function multiply( o, a, b, m, n, k ) {

		o = o | 0;
		a = a | 0;
		b = b | 0;
		m = m | 0;
		n = n | 0;
		k = k | 0;

		var r = 0;
		var c = 0;
		var i = 0;
		var sum = 0.0;
		for ( r = 0; ( r | 0 ) < ( m | 0 ); r = ( r + 1 ) | 0 ) {

			// iterate over k
			for ( c = 0; ( c | 0 ) < ( k | 0 ); c = ( c + 1 ) | 0 ) {

				sum = 0.0;

				// iterate over n
				for ( i = 0; ( i | 0 ) < ( n | 0 ); i = ( i + 1 ) | 0 ) {

					sum = sum +
						heap64[ ( a + imul( r, n ) + i ) >> 3 ] *
						heap64[ ( b + imul( i, k ) + c ) >> 3 ];

				}

				heap64[ ( o + imul( r, n ) + i ) >> 3 ] = sum;

			}

		}

	}

	return { multiply: multiply };

}
