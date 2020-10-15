import { vec4 } from 'gl-matrix';

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

const tempQuat2 = new Float64Array( 16 );
export function quaternionDistance( a, b ) {

	smallestDifferenceQuaternion( tempQuat2, a, b );
	return vec4.length( tempQuat2 );

}

export function quaternionSquaredDistance( a, b ) {

	smallestDifferenceQuaternion( tempQuat2, a, b );
	return vec4.squaredLength( tempQuat2 );

}
