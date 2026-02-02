import { vec3, quat } from 'gl-matrix';
import { DOF } from '../Joint.js';
import { mat } from './matrix.js';
import { rotationVectorFromQuaternion, quaternionDelta } from './quaternion.js';
import { RAD2DEG } from './constants.js';

const tempPos = new Float64Array( 3 );
const tempRotVec = new Float64Array( 3 );
const tempEuler = new Float64Array( 3 );
const tempQuat = new Float64Array( 4 );
const tempQuat2 = new Float64Array( 4 );
export function accumulateClosureError(
	solver,
	joint,
	startIndex,
	errorVector = null,
	result = { isConverged: false, rowCount: 6, totalError: 0 }
) {

	const {
		translationConvergeThreshold,
		rotationConvergeThreshold,
		translationErrorClamp,
		rotationErrorClamp,
		translationFactor,
		rotationFactor,
	} = solver;

	const {
		translationDoFCount,
		rotationDoFCount,
		dofFlags,
		dof,
	} = joint;

	// Get the error from child towards the closure target
	joint.getClosureError( tempPos, tempRotVec );

	// For Goals:
	// - Translation: per-axis masking (individual DoFs)
	// - Rotation: all-or-nothing (rotation vectors can't be decomposed into euler-like components)
	let rowCount = 6;
	if ( joint.isGoal ) {

		// Mask translation per-axis
		tempPos[ 0 ] *= dofFlags[ 0 ];
		tempPos[ 1 ] *= dofFlags[ 1 ];
		tempPos[ 2 ] *= dofFlags[ 2 ];
		rowCount = translationDoFCount;

		// Rotation is all-or-nothing
		if ( rotationDoFCount === 0 ) {

			tempRotVec[ 0 ] = 0;
			tempRotVec[ 1 ] = 0;
			tempRotVec[ 2 ] = 0;

		} else {

			rowCount += 3;

		}

	}

	let isConverged = false;
	let totalError = 0;
	const posMag = vec3.length( tempPos );
	const rotMag = vec3.length( tempRotVec );
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

		vec3.scale( tempPos, tempPos, translationFactor );

		if ( rotMag > rotationErrorClamp ) {

			vec3.scale( tempRotVec, tempRotVec, rotationErrorClamp / rotMag );

		}

		vec3.scale( tempRotVec, tempRotVec, rotationFactor );

		// Goals: per-axis for translation, all-or-nothing for rotation
		if ( joint.isGoal ) {

			// Translation: per-axis
			for ( let i = 0; i < translationDoFCount; i ++ ) {

				const d = dof[ i ];
				mat.set( errorVector, startIndex + i, 0, tempPos[ d ] );

			}

			// Rotation: all-or-nothing (use full rotation vector)
			if ( rotationDoFCount > 0 ) {

				mat.set( errorVector, startIndex + translationDoFCount + 0, 0, tempRotVec[ 0 ] );
				mat.set( errorVector, startIndex + translationDoFCount + 1, 0, tempRotVec[ 1 ] );
				mat.set( errorVector, startIndex + translationDoFCount + 2, 0, tempRotVec[ 2 ] );

			}

		} else {

			mat.set( errorVector, startIndex + 0, 0, tempPos[ 0 ] );
			mat.set( errorVector, startIndex + 1, 0, tempPos[ 1 ] );
			mat.set( errorVector, startIndex + 2, 0, tempPos[ 2 ] );

			mat.set( errorVector, startIndex + 3, 0, tempRotVec[ 0 ] );
			mat.set( errorVector, startIndex + 4, 0, tempRotVec[ 1 ] );
			mat.set( errorVector, startIndex + 5, 0, tempRotVec[ 2 ] );

		}

	}

	result.totalError = totalError;
	result.isConverged = isConverged;
	result.rowCount = rowCount;
	return result;

}

export function accumulateTargetError(
	solver,
	joint,
	startIndex,
	errorVector = null,
	result = { isConverged: false, rowCount: 6, totalError: 0 }
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
		translationFactor,
		rotationFactor,
		dofList,
	} = joint;

	// get the position delta
	const posDelta = vec3.distance( dofValues, dofTarget );

	// For 3-DoF rotation joints, use rotation vector representation which avoids gimbal lock.
	// For 1/2-DoF joints, use euler angle differences with minimum representation.
	let rotDelta;
	if ( rotationDoFCount === 3 ) {

		// Convert current and target euler angles to quaternions
		quat.fromEuler(
			tempQuat,
			dofValues[ DOF.EX ] * RAD2DEG,
			dofValues[ DOF.EY ] * RAD2DEG,
			dofValues[ DOF.EZ ] * RAD2DEG
		);
		quat.fromEuler(
			tempQuat2,
			dofTarget[ DOF.EX ] * RAD2DEG,
			dofTarget[ DOF.EY ] * RAD2DEG,
			dofTarget[ DOF.EZ ] * RAD2DEG
		);

		// Compute rotation vector from current to target
		quaternionDelta( tempQuat, tempQuat2, tempQuat );
		rotationVectorFromQuaternion( tempRotVec, tempQuat );
		rotDelta = vec3.length( tempRotVec );

	} else {

		// For 1/2-DoF, use euler angle differences (with minimum representation applied earlier)
		rotDelta = Math.abs( dofTarget[ DOF.EX ] - dofValues[ DOF.EX ] ) +
			Math.abs( dofTarget[ DOF.EY ] - dofValues[ DOF.EY ] ) +
			Math.abs( dofTarget[ DOF.EZ ] - dofValues[ DOF.EZ ] );

	}

	// Get the row count
	const lockedDoFCount = lockedJointDoFCount.get( joint ) || 0;
	result.rowCount = translationDoFCount + rotationDoFCount - lockedDoFCount;
	result.isConverged = posDelta < translationConvergeThreshold && rotDelta < rotationConvergeThreshold;
	result.totalError = posDelta + rotDelta;

	if ( errorVector ) {

		const lockedDoF = lockedJointDoF.get( joint );
		const isLocked = lockedDoFCount !== 0;

		let rowIndex = 0;

		// error from current state to target
		tempPos[ 0 ] = dofTarget[ 0 ] - dofValues[ 0 ];
		tempPos[ 1 ] = dofTarget[ 1 ] - dofValues[ 1 ];
		tempPos[ 2 ] = dofTarget[ 2 ] - dofValues[ 2 ];

		// clamp the position delta to the max error step
		const posMag = vec3.length( tempPos );
		vec3.scale( tempPos, tempPos, translationFactor * translationErrorClamp / posMag );
		for ( let i = 0, l = translationDoFCount; i < l; i ++ ) {

			const dof = dofList[ i ];

			// skip this degree of freedom if it's locked
			if ( isLocked && lockedDoF[ dof ] ) {

				continue;

			}

			mat.set( errorVector, startIndex + rowIndex, 0, tempPos[ dof ] );
			rowIndex ++;

		}

		// Check if any rotation DoF is locked
		const rotationLocked = isLocked && (
			lockedDoF[ DOF.EX ] || lockedDoF[ DOF.EY ] || lockedDoF[ DOF.EZ ]
		);

		// Use rotation vector for 3-DoF rotation ONLY when all rotation axes are free.
		// When any rotation axis is locked, fall back to euler angles since rotation
		// vector components can't be independently locked (they're coupled).
		const useRotationVector = rotationDoFCount === 3 && ! rotationLocked;

		if ( useRotationVector ) {

			// Rotation vector was already computed above in tempRotVec
			// Clamp and scale
			const rotMag = vec3.length( tempRotVec );
			if ( rotMag > rotationErrorClamp ) {

				vec3.scale( tempRotVec, tempRotVec, rotationErrorClamp / rotMag );

			}

			vec3.scale( tempRotVec, tempRotVec, rotationFactor );

			// Write all 3 rotation vector components
			for ( let i = 0; i < 3; i ++ ) {

				mat.set( errorVector, startIndex + rowIndex, 0, tempRotVec[ i ] );
				rowIndex ++;

			}

		} else {

			// For 1/2-DoF or when rotation is locked, use euler angle differences
			tempEuler[ 0 ] = joint.dofTarget[ 3 ] - joint.dofValues[ 3 ];
			tempEuler[ 1 ] = joint.dofTarget[ 4 ] - joint.dofValues[ 4 ];
			tempEuler[ 2 ] = joint.dofTarget[ 5 ] - joint.dofValues[ 5 ];

			// clamp the euler difference to the error step magnitude
			const eulerMag = vec3.length( tempEuler );
			if ( eulerMag > 0 ) {

				vec3.scale( tempEuler, tempEuler, rotationFactor * rotationErrorClamp / eulerMag );

			}

			for ( let i = translationDoFCount, l = translationDoFCount + rotationDoFCount; i < l; i ++ ) {

				const dof = dofList[ i ];

				// skip this degree of freedom if it's locked
				if ( isLocked && lockedDoF[ dof ] ) {

					continue;

				}

				mat.set( errorVector, startIndex + rowIndex, 0, tempEuler[ dof - 3 ] );
				rowIndex ++;

			}

		}

	}

}
