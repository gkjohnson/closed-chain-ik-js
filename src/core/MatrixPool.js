import { mat } from './utils/matrix.js';

class FixedMatrixPool {

	constructor( row, col ) {

		const matrices = [];
		let index = 0;

		this.get = function () {

			let matrix = matrices[ index ];
			if ( ! matrix ) {

				matrices[ index ] = matrix = mat.create( row, col );

			}

			index ++;
			return matrix;

		};

		this.releaseAll = function () {

			index = 0;

		};

	}

}

export class MatrixPool {

	constructor() {

		const pools = {};
		const poolArray = [];
		this.get = function ( row, col ) {

			let colPools = pools[ row ];
			if ( ! colPools ) {

				colPools = pools[ row ] = {};

			}

			let pool = colPools[ col ];
			if ( ! pool ) {

				pool = colPools[ col ] = new FixedMatrixPool( row, col );
				poolArray.push( pool );

			}

			return pool.get();

		};

		this.releaseAll = function () {

			for ( let i = 0, l = poolArray.length; i < l; i ++ ) {

				poolArray[ i ].releaseAll();

			}

		};

	}

}
