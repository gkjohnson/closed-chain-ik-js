import { Solver } from '../core/Solver.js';
import { SOLVE_STATUS } from '../core/ChainSolver.js';
import { deserialize } from './serialize.js';
import { applyToBuffer, applyFromBuffer } from './utils.js';

let solver = new Solver();
let solveHandle = - 1;

// List of all frames in the graph
let frames = null;

// Buffer variants
let buffer = null;
let floatBuffer = null;
let byteBuffer = null;

global.onmessage = function ( { data: e } ) {

	const { type, data } = e;
	switch ( type ) {

		// The ik graph needs to be updated with all the deserialized
		case 'updateStructure':
			frames = deserialize( data.serialized );
			solver.roots = frames.filter( f => f.parent === null );
			solver.updateStructure();

			buffer = data.buffer;
			byteBuffer = new Uint8Array( buffer );
			floatBuffer = new Float32Array( buffer );
			break;

		// Update the settings of the solver
		case 'updateSolverSettings':
			Object.assign( solver, data );
			break;

		// Start the solve loop
		case 'startSolve':
			if ( solveHandle === - 1 ) {

				updateSolve();

			}

			break;

		// Stop the solve loop
		case 'endSolve':
			if ( solveHandle !== - 1 ) {

				clearTimeout( solveHandle );
				solveHandle = - 1;

			}

			break;

	}

};

// The iterative solve loop
function updateSolve() {

	// Copy any frame updates from the main thread
	applyFromBuffer( frames, floatBuffer, byteBuffer, false, true );

	// Solve 1 iteration taking the most severe chain result
	const result = solver.solve();

	// Copy the new DoF back to the shared buffer
	applyToBuffer( frames, floatBuffer, byteBuffer, true, false );

	if ( result.find( r => r === SOLVE_STATUS.TIMEOUT ) ) {

		// yield so we can react to messages
		solveHandle = setTimeout( updateSolve );

	} else {

		solveHandle = - 1;

	}

	this.postMessage( {

		type: 'updateSolve',
		data: result,

	} );

}
