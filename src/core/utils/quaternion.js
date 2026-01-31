import { vec3, vec4, quat } from 'gl-matrix';

const tempQuat = new Float64Array( 4 );
const tempQuat2 = new Float64Array( 4 );
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

// Convert a quaternion to a "rotation vector" - a 3-element array where the direction
// is the rotation axis and the magnitude is the rotation angle in radians. Also known as
// "Exponential coordinates".
// This representation has no gimbal lock and a unique representation for rotations [ - PI, PI].
export function rotationVectorFromQuaternions( output, a, b ) {

	quaternionDelta( tempQuat, a, b );
	rotationVectorFromQuaternion( output, tempQuat );

}

export function rotationVectorFromQuaternion( output, q ) {

	// ensure the quaternion is normalized otherwise the axis angle function can fail
	quat.normalize( tempQuat, q );

	// Extract axis and angle, then ensure we take the short path (angle <= pi)
	let angle = quat.getAxisAngle( output, tempQuat );
	if ( angle > Math.PI ) {

		angle -= 2 * Math.PI;

	}

	vec3.scale( output, output, angle );

}

// Compute the quaternion that rotates from b to a: q_delta = a * conjugate(b)
export function quaternionDelta( output, a, b ) {

	quat.conjugate( tempQuat2, b );
	quat.multiply( output, a, tempQuat2 );

}

export function quaternionDistance( a, b ) {

	smallestDifferenceQuaternion( tempQuat2, a, b );
	return vec4.length( tempQuat2 );

}

export function quaternionSquaredDistance( a, b ) {

	smallestDifferenceQuaternion( tempQuat2, a, b );
	return vec4.squaredLength( tempQuat2 );

}
