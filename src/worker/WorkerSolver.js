/** @import { Frame } from '../core/Frame.js' */
import { SOLVE_STATUS } from '../core/ChainSolver.js';
import { serialize } from './serialize.js';
import {
	generateSharedBuffer,
	applyToBuffer,
	copyFrameToBuffer,
	copyBufferToFrame,
	JOINT_STRIDE,
} from './utils.js';
import { findRoots } from '../core/utils/IKUtils.js';

const useSharedArrayBuffers = ( typeof SharedArrayBuffer ) !== 'undefined';

/**
 * Runs the `Solver` asynchronously in a WebWorker. The worker owns a copy of the frames and the
 * resulting joint values are copied back onto the frames on the main thread as solves complete.
 * @param {Frame | Array<Frame>} roots - The roots of the trees to solve.
 * @warn When `SharedArrayBuffer` is not available a new `ArrayBuffer` is copied to the worker
 * on every update and back with every result.
 */
export class WorkerSolver {

	constructor( roots = [] ) {

		/**
		 * The roots to solve for. If modified `updateStructure` must be called.
		 * @type {Array<Frame>}
		 */
		this.roots = Array.isArray( roots ) ? [ ...roots ] : [ roots ];

		/**
		 * The `SOLVE_STATUS` of each chain from the most recent solve in the worker.
		 * @type {Array<number>}
		 * @readonly
		 */
		this.status = [];

		/**
		 * Whether a solve is running in the worker.
		 * @type {boolean}
		 * @readonly
		 */
		this.running = false;

		this.frames = null;
		this.buffer = null;
		this.floatBuffer = null;
		this.byteBuffer = null;
		this.jointsToUpdate = null;
		this.jointsToIndexMap = null;
		this.scheduledStateUpdate = false;

		const worker = new Worker( new URL( './workerSolver.worker.js', import.meta.url ), { type: 'module' } );
		let scheduled = false;
		worker.onmessage = ( { data: e } ) => {

			if ( e.type === 'updateSolve' ) {

				// If the solve is completed then schedule a copy onto our joints to avoid
				// copying multiple times per frame.
				if ( ! scheduled ) {

					scheduled = true;
					Promise.resolve().then( () => {

						// Only copy the DoF values of the joints that are to move.
						let byteBuffer, floatBuffer;
						if ( useSharedArrayBuffers ) {

							byteBuffer = this.byteBuffer;
							floatBuffer = this.floatBuffer;

						} else {

							byteBuffer = new Uint8Array( e.data.buffer );
							floatBuffer = new Float32Array( e.data.buffer );

						}

						const { jointsToIndexMap, jointsToUpdate } = this;
						for ( let i = 0, l = jointsToUpdate.length; i < l; i ++ ) {

							const joint = jointsToUpdate[ i ];
							const index = jointsToIndexMap.get( joint );

							copyBufferToFrame( joint, floatBuffer, byteBuffer, index * JOINT_STRIDE, true, false );

						}

						scheduled = false;

					} );

				}

				const status = e.data.status;
				this.status = status;
				if ( ! status.includes( SOLVE_STATUS.TIMEOUT ) ) {

					this.running = false;

				}

			}

		};

		this.worker = worker;
		this.updateStructure();

	}

	/**
	 * Sends the structure of the trees to the worker. Must be called whenever the parent child
	 * structure, the degrees of freedom of a joint, or the joint values are changed on the main
	 * thread.
	 */
	updateStructure() {

		// TODO: do we need to track versions of the structure now if we use
		// normal array buffers so we don't respond to an outdated update event?

		const { worker } = this;

		const roots = findRoots( this.roots );

		// Get all frames in the graph
		const framesSet = new Set();
		roots.forEach( root => root.traverse( c => {

			framesSet.add( c );

		} ) );

		// Seralize the frames and generate a buffer
		const frames = Array.from( framesSet );
		const serialized = serialize( frames );

		const buffer = generateSharedBuffer( frames, useSharedArrayBuffers );
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

		if ( useSharedArrayBuffers ) {

			this.buffer = buffer;
			this.floatBuffer = floatBuffer;
			this.byteBuffer = byteBuffer;

		} else {

			this.buffer = buffer.slice();
			this.floatBuffer = new Float32Array( this.buffer );
			this.byteBuffer = new Uint8Array( this.buffer );

		}

		this.frames = frames;
		this.jointsToUpdate = jointsToUpdate;
		this.jointsToIndexMap = jointsToIndexMap;

		if ( useSharedArrayBuffers ) {

			worker.postMessage( {
				type: 'updateStructure',
				data: {
					serialized,
					buffer,
				},
			} );

		} else {

			worker.postMessage( {
				type: 'updateStructure',
				data: {
					serialized,
					buffer,
				},
			}, [ buffer ] );

		}

	}

	/**
	 * Sets the given `Solver` options on the solver in the worker.
	 * @param {Object} settings - Option names and values as listed on `Solver`.
	 */
	updateSolverSettings( settings ) {

		this.worker.postMessage( {
			type: 'updateSolverSettings',
			data: settings,
		} );

	}

	/**
	 * Copies the frame transforms and joint settings, everything except the joint values being
	 * solved for, to the worker. Copies every frame if none are given.
	 * @param {...Frame} frames - The frames to copy.
	 */
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

		if ( ! useSharedArrayBuffers && ! this.scheduledStateUpdate ) {

			this.scheduledStateUpdate = true;
			Promise.resolve().then( () => {

				this.scheduledStateUpdate = false;
				const buffer = this.buffer.slice();
				this.worker.postMessage( {
					type: 'updateFrameState',
					data: {
						buffer,
					},
				}, [ buffer ] );

			} );

		}

	}

	/**
	 * Starts a solve loop in the worker if one is not running. The loop stops on its own once no
	 * chain returns `SOLVE_STATUS.TIMEOUT`.
	 */
	solve() {

		this.worker.postMessage( {
			type: 'startSolve',
		} );
		this.running = true;

	}

	/**
	 * Stops the solve loop in the worker.
	 */
	stop() {

		this.worker.postMessage( {
			type: 'stopSolve',
		} );
		this.running = false;

	}

	/**
	 * Stops the solve loop and terminates the worker.
	 */
	dispose() {

		this.stop();
		this.worker.terminate();
		this.worker = null;

	}

}
