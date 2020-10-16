import { SOLVE_STATUS } from '../core/ChainSolver.js';
import { serialize } from './serialize.js';
import { generateSharedBuffer, applyToBuffer, copyFrameToBuffer, copyBufferToFrame, JOINT_STRIDE } from './utils.js';

export class WorkerSolver {

	constructor( roots ) {

		this.roots = Array.isArray( roots ) ? [ ...roots ] : [ roots ];
		this.status = - 1;
		this.running = false;

		this.frames = null;
		this.buffer = null;
		this.floatBuffer = null;
		this.byteBuffer = null;
		this.jointsToUpdate = null;
		this.jointsToIndexMap = null;

		const worker = new Worker( './workerSolver.worker.js' );
		let scheduled = false;
		worker.onmessage = ( { data: e } ) => {

			if ( e.type === 'updateSolve' ) {

				// If the solve is completed then schedule a copy onto our joints to avoid
				// copying multiple times per frame.
				if ( ! scheduled ) {

					scheduled = true;
					Promise.resolve().then( () => {

						// Only copy the DoF values of the joints that are to move.
						const { byteBuffer, floatBuffer, jointsToIndexMap, jointsToUpdate } = this;
						for ( let i = 0, l = jointsToUpdate.length; i < l; i ++ ) {

							const joint = jointsToUpdate[ i ];
							const index = jointsToIndexMap.get( joint );

							copyBufferToFrame( joint, floatBuffer, byteBuffer, index * JOINT_STRIDE, true, false );

						}

						scheduled = false;

					} );

				}

				const status = e.data;
				this.status = status;
				if ( status !== SOLVE_STATUS.TIMEOUT ) {

					this.running = false;

				}

			}

		};

		this.worker = worker;
		this.updateStructure();

	}

	// Update the structure of the graph in the worker. Must be called every time the graph structure
	// changes or a degree of freedom changes. Or if the main thread must change the DoF values.
	updateStructure() {

		const { roots, worker } = this;

		// Get all frames in the graph
		const framesSet = new Set();
		roots.forEach( root => root.traverse( c => {

			framesSet.add( c );

		} ) );

		// Seralize the frames and generate a buffer
		const frames = Array.from( framesSet );
		const serialized = serialize( frames );
		const buffer = generateSharedBuffer( frames );
		const floatBuffer = new Float32Array( buffer );
		const byteBuffer = new Uint8Array( buffer );

		// Filter all the frames down to joints that should be updated from
		// the worker.
		const jointsToUpdate = [];
		const jointsToIndexMap = new Map();
		for ( let i = 0, l = frames.length; i < l; i ++ ) {

			const frame = frames[ i ];
			if ( frame.isJoint && frame.dof.length > 0 ) {

				jointsToUpdate.push( frame );
				jointsToIndexMap.set( frame, i );

			}

		}

		worker.postMessage( {
			type: 'updateStructure',
			data: {
				serialized,
				buffer,
			},
		} );

		this.frames = frames;
		this.buffer = buffer;
		this.floatBuffer = floatBuffer;
		this.byteBuffer = byteBuffer;
		this.jointsToUpdate = jointsToUpdate;
		this.jointsToIndexMap = jointsToIndexMap;

	}

	// Update the solver settings via a settings object.
	updateSolverSettings( settings ) {

		this.worker.postMessage( {
			type: 'updateSolverSettings',
			data: settings,
		} );

	}

	// Copy the non DoF values over to shared buffer for use in the worker
	updateFrameState( ...updateJoints ) {

		const { frames, floatBuffer, byteBuffer } = this;
		if ( updateJoints.length === 0 ) {

			applyToBuffer( frames, floatBuffer, byteBuffer, false, true );

		} else {

			for ( let i = 0, l = updateJoints.length; i < l; i ++ ) {

				const frame = updateJoints[ i ];
				const index = frames.indexOf( frame );

				copyFrameToBuffer( frame, floatBuffer, byteBuffer, JOINT_STRIDE * index, false, true );

			}

		}

	}

	// Start the solve loop if it's not running
	solve() {

		this.worker.postMessage( {
			type: 'startSolve',
		} );
		this.running = true;

	}

	// Stop the solve loop
	stop() {

		this.worker.postMessage( {
			type: 'stopSolve',
		} );
		this.running = false;

	}

	// Stop and dispose the worker
	dispose() {

		this.stop();
		this.worker.terminate();
		this.worker = null;

	}

}
