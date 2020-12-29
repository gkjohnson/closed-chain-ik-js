import { Joint } from '../core/Joint.js';
import { Link } from '../core/Link.js';
import { Goal } from '../core/Goal.js';

// Takes a list of interconnected frames and serializes them into a non cyclic json representation
export function serialize( frames ) {

	const map = new Map();
	const info = [];

	// Create the initial frame list along with a joint -> index map
	for ( let i = 0, l = frames.length; i < l; i ++ ) {

		const frame = frames[ i ];

		const {
			name,
			dof,
			dofValues,
			dofTarget,
			dofRestPose,
			minDoFLimit,
			maxDoFLimit,
			targetSet,
			restPoseSet,
			position,
			quaternion,
			isClosure,
		} = frame;

		let type = 'Link';
		if ( frame.isGoal ) {

			type = 'Goal';

		} else if ( frame.isJoint ) {

			type = 'Joint';

		}

		const res = {
			dof: dof ? dof.slice() : null,
			dofValues: dofValues ? dofValues.slice() : null,
			dofTarget: dofTarget ? dofTarget.slice() : null,
			dofRestPose: dofRestPose ? dofRestPose.slice() : null,
			minDoFLimit: minDoFLimit ? minDoFLimit.slice() : null,
			maxDoFLimit: maxDoFLimit ? maxDoFLimit.slice() : null,
			targetSet,
			restPoseSet,
			isClosure,

			name,
			position: position.slice(),
			quaternion: quaternion.slice(),
			children: null,
			closureJoints: null,
			child: null,
			type,
		};

		info.push( res );
		map.set( frame, i );

	}

	// Create the child and parent index references.
	for ( let i = 0, l = frames.length; i < l; i ++ ) {

		const inf = info[ i ];
		const frame = frames[ i ];
		inf.children = frame.children.map( c => map.get( c ) );
		if ( frame.isLink ) {

			inf.closureJoints = frame.closureJoints.map( c => map.get( c ) );

		}

		if ( frame.isJoint && frame.child ) {

			inf.child = map.get( frame.child );

		}

		if ( frame.parent ) {

			inf.parent = map.get( frame.parent );

		} else {

			inf.parent = null;

		}

	}

	return info;

}

// Deserialize the serialized representation of the graph
export function deserialize( data ) {

	// Create joints / links for every serialized version
	const frames =
		data.map( d => {

			const {
				type,
				name,
				position,
				quaternion,

				dof,
				dofValues,
				dofTarget,
				dofRestPose,
				minDoFLimit,
				maxDoFLimit,
				targetSet,
				restPoseSet,
				isClosure,
			} = d;

			let frame;
			switch ( type ) {

				case 'Goal':
				case 'Joint':
					frame = type === 'Goal' ? new Goal() : new Joint();

					frame.setDoF( ...dof );
					frame.dofValues.set( dofValues );
					frame.dofTarget.set( dofTarget );
					frame.dofRestPose.set( dofRestPose );
					frame.minDoFLimit.set( minDoFLimit );
					frame.maxDoFLimit.set( maxDoFLimit );

					frame.targetSet = targetSet;
					frame.restPoseSet = restPoseSet;
					frame.isClosure = isClosure;
					break;
				case 'Link':
					frame = new Link();
					break;

			}

			frame.name = name;
			frame.position.set( position );
			frame.quaternion.set( quaternion );
			return frame;

		} );

	// set the parent and child from the maps
	for ( let i = 0; i < frames.length; i ++ ) {

		const frame = frames[ i ];
		const info = data[ i ];

		frame.parent = frames[ info.parent ] || null;
		frame.children.push( ...info.children.map( i => frames[ i ] ) );
		frame.setMatrixNeedsUpdate();

		if ( frame.isLink ) {

			frame.closureJoints.push( ...info.closureJoints.map( i => frames[ i ] ) );

		}

		if ( frame.isJoint ) {

			frame.child = info.child !== null ? frames[ info.child ] : null;
			frame.setMatrixDoFNeedsUpdate();

		}

	}

	return frames;

}
