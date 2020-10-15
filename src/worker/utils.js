export const JOINT_STRIDE = 304;

export const LINK_STRIDE = 56;

export function generateSharedBuffer( frames ) {

	// dofValues 	6 * 8
	// dofTarget 	6 * 8
	// dofRestPose 	6 * 8
	// minDoFLimit 	6 * 8
	// maxDoFLimit 	6 * 8
	// position 	3 * 8
	// quaternion 	4 * 8
	// targetSet 	1
	// restPoseSet 	1
	// --
	// total  		298 bytes per joint
	// 8 byte aligned: 304

	const arrayBuffer = new SharedArrayBuffer( JOINT_STRIDE * frames.length );
	const float64 = new Float64Array( arrayBuffer );
	const byte8 = new Uint8Array( arrayBuffer );
	applyToBuffer( frames, float64, byte8 );
	return arrayBuffer;

}

export function applyToBuffer( frames, float64, byte8, copyDoFValues = true, copyJointSettings = true ) {

	for ( let i = 0, l = frames.length; i < l; i ++ ) {

		copyFrameToBuffer( frames[ i ], float64, byte8, i * JOINT_STRIDE, copyDoFValues, copyJointSettings );

	}

}

export function applyFromBuffer( frames, float64, byte8, copyDoFValues = true, copyJointSettings = true  ) {

	for ( let i = 0, l = frames.length; i < l; i ++ ) {

		copyBufferToFrame( frames[ i ], float64, byte8, JOINT_STRIDE * i, copyDoFValues, copyJointSettings );

	}

}

// Copy data from the frame to the given buffer starting at the given byte offset. Joints take JOINT_STRIDE
// bytes while links take LINK_STRIDE bytes.
export function copyFrameToBuffer(
	frame,
	float64,
	byte8,
	byteOffset,
	copyDoFValues = true,
	copyJointSettings = true,
) {

	const floatOffset = byteOffset / 8;
	if ( copyJointSettings ) {

		const {
			position,
			quaternion,
		} = frame;
		for ( let i = 0; i < 3; i ++ ) {

			float64[ floatOffset + 0 + i ] = position[ i ];

		}

		for ( let i = 0; i < 4; i ++ ) {

			float64[ floatOffset + 3 + i ] = quaternion[ i ];

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

				float64[ floatOffset + 7 + 0 * 6 + i ] = dofTarget[ i ];
				float64[ floatOffset + 7 + 1 * 6 + i ] = dofRestPose[ i ];
				float64[ floatOffset + 7 + 2 * 6 + i ] = minDoFLimit[ i ];
				float64[ floatOffset + 7 + 3 * 6 + i ] = maxDoFLimit[ i ];

			}

			byte8[ byteOffset + 296 ] = Number( targetSet );
			byte8[ byteOffset + 297 ] = Number( restPoseSet );

		}


	}

	if ( copyDoFValues && frame.isJoint ) {

		const { dofValues } = frame;

		for ( let i = 0; i < 6; i ++ ) {

			float64[ floatOffset + 7 + 4 * 6 + i ] = dofValues[ i ];

		}

	}

}

// Copy data from the given buffer to the given frame starting at the given byte offset.
export function copyBufferToFrame(
	joint,
	float64,
	byte8,
	byteOffset,
	copyDoFValues = true,
	copyJointSettings = true,
) {

	const floatOffset = byteOffset / 8;

	if ( copyJointSettings ) {

		joint.setPosition(
			float64[ floatOffset + 0 ],
			float64[ floatOffset + 1 ],
			float64[ floatOffset + 2 ],
		);
		joint.setQuaternion(
			float64[ floatOffset + 3 + 0 ],
			float64[ floatOffset + 3 + 1 ],
			float64[ floatOffset + 3 + 2 ],
			float64[ floatOffset + 3 + 3 ],
		);

		if ( joint.isJoint ) {

			const {
				dofTarget,
				dofRestPose,
				minDoFLimit,
				maxDoFLimit,
			} = joint;

			for ( let i = 0; i < 6; i ++ ) {

				dofTarget[ i ] = float64[ floatOffset + 7 + 0 * 6 + i ];
				dofRestPose[ i ] = float64[ floatOffset + 7 + 1 * 6 + i ];
				minDoFLimit[ i ] = float64[ floatOffset + 7 + 2 * 6 + i ];
				maxDoFLimit[ i ] = float64[ floatOffset + 7 + 3 * 6 + i ];

			}

			joint.targetSet = Boolean( byte8[ byteOffset + 296 ] );
			joint.restPoseSet = Boolean( byte8[ byteOffset + 297 ] );

		}

	}

	if ( copyDoFValues && joint.isJoint ) {

		const { dofValues } = joint;
		let changed = false;
		for ( let i = 0; i < 6; i ++ ) {

			const v = float64[ floatOffset + 7 + 4 * 6 + i ];
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
