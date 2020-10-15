import { mat } from '../src/core/utils/matrix.js';
import { runBenchmark } from './run-benchmark.js';

let a = mat.create( 200, 200 );
let b = mat.create( 200, 200 );
let c = mat.create( 200, 200 );

runBenchmark(
	'matrix multiplication',
	null,
	() => {

		mat.multiply( c, a, b, 200 );

	},
	3000
);
