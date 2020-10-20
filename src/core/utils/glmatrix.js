// https://github.com/toji/gl-matrix/issues/329
import { mat4, vec3 } from 'gl-matrix';
import { RAD2DEG } from './constants.js';
import { smallestDifferenceQuaternion } from './quaternion.js';

const tempPos = new Float64Array( 3 );
const tempQuat = new Float64Array( 4 );
const tempPos2 = new Float64Array( 3 );
const tempQuat2 = new Float64Array( 4 );

/**
 * Returns an euler angle representation of a quaternion
 * @param {vec3} out Euler angles, pitch-yaw-roll
 * @param {quat} mat Quaternion
 * @return {vec3} out
 */
export function getEuler( out, quat ) {

	// https://math.stackexchange.com/questions/2975109/how-to-convert-euler-angles-to-quaternions-and-get-the-same-euler-angles-back-fr
	const [ x, y, z, w ] = quat;

	const t0 = 2.0 * ( w * x + y * z );
	const t1 = 1.0 - 2.0 * ( x * x + y * y );
	const roll = Math.atan2( t0, t1 );

	let t2 = 2.0 * ( w * y - z * x );
	t2 = t2 > 1.0 ? 1.0 : t2;
	t2 = t2 < - 1.0 ? - 1.0 : t2;
	const pitch = Math.asin( t2 );

	const t3 = 2.0 * ( w * z + x * y );
	const t4 = 1.0 - 2.0 * ( y * y + z * z );
	const yaw = Math.atan2( t3, t4 );

	out[ 0 ] = roll * RAD2DEG;
	out[ 1 ] = pitch * RAD2DEG;
	out[ 2 ] = yaw * RAD2DEG;

	return out;

}

export function getMatrixDifference( a, b, outPos, outQuat ) {

	mat4.getTranslation( tempPos, a );
	mat4.getRotation( tempQuat, a );

	mat4.getTranslation( tempPos2, b );
	mat4.getRotation( tempQuat2, b );

	vec3.subtract( outPos, tempPos, tempPos2 );
	smallestDifferenceQuaternion( outQuat, tempQuat, tempQuat2 );

	// error of A - B

}
