import { vec3, vec4 } from 'gl-matrix';

const tempPos = new Float64Array( 3 );
const tempQuat = new Float64Array( 4 );

export function accumulateClosureError(
	solver,
	joint,
	startIndex,
	errorVector = null,
	result = { isConverged: false, rowCount: 7, totalError: 0 }
) {

	const {
		translationConvergeThreshold,
		rotationConvergeThreshold,
		translationErrorClamp,
		rotationErrorClamp,
	} = solver;

	// TODO: If this is a Goal and we have less than three euler DoF we should use euler angles (and adjust the rows). Otherwise we
	// should use a quat.
	joint.getClosureError( tempPos, tempQuat );

	let isConverged = false;
	let totalError = 0;
	const posMag = vec3.length( tempPos );
	const rotMag = vec4.length( tempQuat );
	if (
		posMag < translationConvergeThreshold &&
		rotMag < rotationConvergeThreshold
	) {

		isConverged = true;

	}

	totalError += posMag + rotMag;

	if ( errorVector ) {


		if ( posMag > translationErrorClamp ) {

			vec3.scale( tempPos, tempPos, translationErrorClamp / posMag );

		}

		if ( rotMag > rotationErrorClamp ) {

			vec4.scale( tempQuat, tempQuat, rotationErrorClamp / rotMag );

		}

		errorVector[ startIndex + 0 ][ 0 ] = tempPos[ 0 ];
		errorVector[ startIndex + 1 ][ 0 ] = tempPos[ 1 ];
		errorVector[ startIndex + 2 ][ 0 ] = tempPos[ 2 ];

		errorVector[ startIndex + 3 ][ 0 ] = tempQuat[ 0 ];
		errorVector[ startIndex + 4 ][ 0 ] = tempQuat[ 1 ];
		errorVector[ startIndex + 5 ][ 0 ] = tempQuat[ 2 ];
		errorVector[ startIndex + 6 ][ 0 ] = tempQuat[ 3 ];

	}

	result.totalError = totalError;
	result.isConverged = isConverged;
	result.rowCount = 7;
	return result;

}

export function accumulateTargetError(
	solver,
	joint,
	startIndex,
	errorVector = null,
	result = { isConverged: false, rowCount: 7, totalError: 0 }
) {

	// Find whether or not the target has converged or not
	const {
		translationConvergeThreshold,
		rotationConvergeThreshold,
		lockedJointDoFCount,
		translationErrorClamp,
		rotationErrorClamp,
		lockedJointDoF,
	} = solver;

	const {
		dofTarget,
		dofValues,
		translationDoFCount,
		rotationDoFCount,
	} = joint;

	// get the position delta
	const posDelta = vec3.distance( dofValues, dofTarget );

	// TODO: if three euler angles are being used we should set this to a quaternion to measure
	// error rather than euler angles.
	// Before running this solver we try to ensure the target and restPose are minimized
	let rotDelta =
		dofTarget[ DOF.EX ] - dofValues[ DOF.EX ] +
		dofTarget[ DOF.EY ] - dofValues[ DOF.EY ] +
		dofTarget[ DOF.EZ ] - dofValues[ DOF.EZ ];

	// Get the row count
	const lockedDoFCount = lockedJointDoFCount.get( joint ) || 0;
	result.rowCount = translationDoFCount + rotationDoFCount - lockedDoFCount;
	result.isConverged = posDelta < translationConvergeThreshold && rotDelta < rotationConvergeThreshold;
	errorResult.totalError = posDelta + rotDelta;

	if ( errorVector ) {

		const lockedDoF = lockedJointDoF.get( joint );
		const isLocked = lockedDoFCount !== 0;
		const rowIndex = 0;

		// error from current state to target
		tempPos[ 0 ] = dofTarget[ 0 ] - dofValues[ 0 ];
		tempPos[ 1 ] = dofTarget[ 1 ] - dofValues[ 1 ];
		tempPos[ 2 ] = dofTarget[ 2 ] - dofValues[ 2 ];

		// clamp the position delta to the max error step
		const posMag = vec3.length( tempPos );
		vec3.scale( tempPos, tempPos, translationErrorClamp / posMag );
		for ( let i = 0, l = translationDoFCount; i < l; i ++ ) {

			const dof = dofList[ i ];

			// skip this degree of freedom if it's locked
			if ( isLocked && lockedDoF[ dof ] ) {

				continue;

			}

			errorVector[ startIndex + rowIndex ][ 0 ] = tempPos[ dof ];
			rowIndex ++;

		}

		// get the euler differences
		// before running this solver we minimize the euler targets
		tempEuler[ 0 ] = joint.dofTarget[ 3 ] - joint.dofValues[ 3 ];
		tempEuler[ 1 ] = joint.dofTarget[ 4 ] - joint.dofValues[ 4 ];
		tempEuler[ 2 ] = joint.dofTarget[ 5 ] - joint.dofValues[ 5 ];

		// clamp the euler difference to the error step magnitude
		const eulerMag = vec3.length( tempEuler );
		vec3.scale( tempEuler, tempEuler, rotationErrorClamp / eulerMag );
		for ( let i = translationDoFCount, l = translationDoFCount + rotationDoFCount; i < l; i ++ ) {

			const dof = dofList[ i ];

			// skip this degree of freedom if it's locked
			if ( isLocked && lockedDoF[ dof ] ) {

				continue;

			}

			errorVector[ startIndex + rowIndex ][ 0 ] = tempEuler[ dof ];
			rowIndex ++;

		}

	}

}
