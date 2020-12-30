export const JOINT_STRIDE = 304;

export const LINK_STRIDE = 56;

export function generateSharedBuffer( frames, useSharedArrayBuffer = true ) {

	// dofValues 	6 * 4
	// dofTarget 	6 * 4
	// dofRestPose 	6 * 4
	// minDoFLimit 	6 * 4
	// maxDoFLimit 	6 * 4
	// position 	3 * 4
	// quaternion 	4 * 4
	// targetSet 	1
	// restPoseSet 	1
	// --
	// total  		150 bytes per joint
	// 4 byte aligned: 152

	let arrayBuffer;
	if ( useSharedArrayBuffer ) {

		arrayBuffer = new SharedArrayBuffer( JOINT_STRIDE * frames.length );

	} else {

		arrayBuffer = new ArrayBuffer( JOINT_STRIDE * frames.length );

	}

	const float64 = new Float32Array( arrayBuffer );
	const byte8 = new Uint8Array( arrayBuffer );
	applyToBuffer( frames, float64, byte8 );
	return arrayBuffer;

}

export function applyToBuffer( frames, floatBuffer, byteBuffer, copyDoFValues = true, copyJointSettings = true ) {

	for ( let i = 0, l = frames.length; i < l; i ++ ) {

		copyFrameToBuffer( frames[ i ], floatBuffer, byteBuffer, i * JOINT_STRIDE, copyDoFValues, copyJointSettings );

	}

}

export function applyFromBuffer( frames, floatBuffer, byteBuffer, copyDoFValues = true, copyJointSettings = true ) {

	for ( let i = 0, l = frames.length; i < l; i ++ ) {

		copyBufferToFrame( frames[ i ], floatBuffer, byteBuffer, JOINT_STRIDE * i, copyDoFValues, copyJointSettings );

	}

}

// Copy data from the frame to the given buffer starting at the given byte offset. Joints take JOINT_STRIDE
// bytes while links take LINK_STRIDE bytes.
export function copyFrameToBuffer(
	frame,
	floatBuffer,
	byteBuffer,
	byteOffset,
	copyDoFValues = true,
	copyJointSettings = true,
) {

	const floatOffset = byteOffset / 4;
	if ( copyJointSettings ) {

		const {
			position,
			quaternion,
		} = frame;
		for ( let i = 0; i < 3; i ++ ) {

			floatBuffer[ floatOffset + 0 + i ] = position[ i ];

		}

		for ( let i = 0; i < 4; i ++ ) {

			floatBuffer[ floatOffset + 3 + i ] = quaternion[ i ];

		}

		if ( frame.isJoint ) {

			const {
				dofTarget,
				dofRestPose,
				minDoFLimit,
				maxDoFLimit,
				targetSet,
				restPoseSet,
			} = frame;

			for ( let i = 0; i < 6; i ++ ) {

				floatBuffer[ floatOffset + 7 + 0 * 6 + i ] = dofTarget[ i ];
				floatBuffer[ floatOffset + 7 + 1 * 6 + i ] = dofRestPose[ i ];
				floatBuffer[ floatOffset + 7 + 2 * 6 + i ] = minDoFLimit[ i ];
				floatBuffer[ floatOffset + 7 + 3 * 6 + i ] = maxDoFLimit[ i ];

			}

			byteBuffer[ byteOffset + 148 ] = Number( targetSet );
			byteBuffer[ byteOffset + 149 ] = Number( restPoseSet );

		}


	}

	if ( copyDoFValues && frame.isJoint ) {

		const { dofValues } = frame;

		for ( let i = 0; i < 6; i ++ ) {

			floatBuffer[ floatOffset + 7 + 4 * 6 + i ] = dofValues[ i ];

		}

	}

}

// Copy data from the given buffer to the given frame starting at the given byte offset.
export function copyBufferToFrame(
	joint,
	floatBuffer,
	byteBuffer,
	byteOffset,
	copyDoFValues = true,
	copyJointSettings = true,
) {

	const floatOffset = byteOffset / 4;

	if ( copyJointSettings ) {

		joint.setPosition(
			floatBuffer[ floatOffset + 0 ],
			floatBuffer[ floatOffset + 1 ],
			floatBuffer[ floatOffset + 2 ],
		);
		joint.setQuaternion(
			floatBuffer[ floatOffset + 3 + 0 ],
			floatBuffer[ floatOffset + 3 + 1 ],
			floatBuffer[ floatOffset + 3 + 2 ],
			floatBuffer[ floatOffset + 3 + 3 ],
		);

		if ( joint.isJoint ) {

			const {
				dofTarget,
				dofRestPose,
				minDoFLimit,
				maxDoFLimit,
			} = joint;

			for ( let i = 0; i < 6; i ++ ) {

				dofTarget[ i ] = floatBuffer[ floatOffset + 7 + 0 * 6 + i ];
				dofRestPose[ i ] = floatBuffer[ floatOffset + 7 + 1 * 6 + i ];
				minDoFLimit[ i ] = floatBuffer[ floatOffset + 7 + 2 * 6 + i ];
				maxDoFLimit[ i ] = floatBuffer[ floatOffset + 7 + 3 * 6 + i ];

			}

			joint.targetSet = Boolean( byteBuffer[ byteOffset + 148 ] );
			joint.restPoseSet = Boolean( byteBuffer[ byteOffset + 149 ] );

		}

	}

	if ( copyDoFValues && joint.isJoint ) {

		const { dofValues } = joint;
		let changed = false;
		for ( let i = 0; i < 6; i ++ ) {

			const v = floatBuffer[ floatOffset + 7 + 4 * 6 + i ];
			if ( v !== dofValues[ i ] ) {

				dofValues[ i ] = v;
				changed = true;

			}


		}

		// only update dof matrix if it changed
		if ( changed ) {

			joint.setMatrixDoFNeedsUpdate();

		}

	}

}
