import { vec3, vec4, quat } from 'gl-matrix';

const tempQuat = new Float64Array( 16 );
export function smallestDifferenceQuaternion( output, a, b ) {

	// inverting all values yields the same rotation
	vec4.scale( tempQuat, b, - 1 );

	// return the quat that represents the smallest difference
	if ( vec4.squaredDistance( a, tempQuat ) < vec4.squaredDistance( a, b ) ) {

		vec4.subtract( output, a, tempQuat );

	} else {

		vec4.subtract( output, a, b );

	}

}

// Compute the rotation from quaternion b to quaternion a as a "rotation vector".
//
// A rotation vector is a 3-element array where the direction is the rotation axis
// and the magnitude is the rotation angle (in radians). This representation is also
// known as:
//   - Exponential coordinates (Lie group theory, Modern Robotics textbook)
//   - Rodrigues vector (computer vision, though technically that's tan(θ/2)*axis)
//   - Axis-angle compact form (when axis and angle are combined into one vector)
//   - so(3) element (the Lie algebra of SO(3))
//
// This representation has no gimbal lock and a unique representation for small
// rotations, making it ideal for IK error computation.
const tempErrorQuat = new Float64Array( 4 );
export function rotationVectorFromQuaternions( output, a, b ) {

	// q_error = a * conjugate(b) - rotation from b to a
	quat.conjugate( tempErrorQuat, b );
	quat.multiply( tempErrorQuat, a, tempErrorQuat );

	quat.normalize( tempErrorQuat, tempErrorQuat );

	// Extract axis and angle, then ensure we take the short path (angle <= π)
	let angle = quat.getAxisAngle( output, tempErrorQuat );
	if ( angle > Math.PI ) {

		angle -= 2 * Math.PI;

	}

	vec3.scale( output, output, angle );

}

const tempQuat2 = new Float64Array( 16 );
export function quaternionDistance( a, b ) {

	smallestDifferenceQuaternion( tempQuat2, a, b );
	return vec4.length( tempQuat2 );

}

export function quaternionSquaredDistance( a, b ) {

	smallestDifferenceQuaternion( tempQuat2, a, b );
	return vec4.squaredLength( tempQuat2 );

}
