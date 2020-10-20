import { vec3 } from 'gl-matrix';
import { PI, PI2, HALF_PI } from './constants.js';

// Clamp the given angle to ( - PI, PI ]
function clampEulerValue( value ) {

	let result = value % PI2;
	if ( result > PI ) {

		result -= PI2;

	} else if ( result <= - PI ) {

		result += PI2;

	}

	return result;

}

// Convert `toAdjust` to be the equivalent rotation that is closest to target.
function toSmallestEulerValueDistance( target, toAdjust ) {

	const wholeRotation = Math.round( target / PI2 ) * PI2;
	const clampedValue = clampEulerValue( toAdjust );

	let result = wholeRotation + clampedValue;
	const delta = result - target;
	if ( Math.abs( delta ) > PI ) {

		result -= Math.sign( delta ) * PI2;

	}

	return result;

}

// Convert the set of euler angles toAdjust to the smallest equivalent rotation
// that is closest to target.
function toSmallestEulerDistance( output, target, toAdjust ) {

	output[ 0 ] = toSmallestEulerValueDistance( target[ 0 ], toAdjust[ 0 ] );
	output[ 1 ] = toSmallestEulerValueDistance( target[ 1 ], toAdjust[ 1 ] );
	output[ 2 ] = toSmallestEulerValueDistance( target[ 2 ], toAdjust[ 2 ] );

}

// Return the total diff between euler values
function diffEulerDistance( a, b ) {

	// if `a` or `b` is a redundant twist representation then we convert them to the
	// closest twist variation

	let result =
		Math.abs( a[ 0 ] - b[ 0 ] ) +
		Math.abs( a[ 1 ] - b[ 1 ] ) +
		Math.abs( a[ 2 ] - b[ 2 ] );

	return result;

}

// Convert the given euler angles to an equivalent rotation
function getRedundantEulerRepresentation( output, input ) {

	output[ 0 ] = input[ 0 ] + PI;
	output[ 1 ] = PI - input[ 1 ];
	output[ 2 ] = input[ 2 ] + PI;

}

function isRedundantTwist( euler ) {

	const pivotAngle = clampEulerValue( euler[ 1 ] );
	if ( Math.abs( Math.abs( pivotAngle ) - HALF_PI ) > 1e-7 ) {

		return false;

	}

	return true;

}

// If toAdjust has a redundant rotation axis then find the representation that's closest to
// the target set of angles.
function toSmallestRedundantTwistRepresentation( output, target, toAdjust ) {

	if ( ! isRedundantTwist( toAdjust ) ) {

		return false;

	}

	const pivotAngle = clampEulerValue( toAdjust[ 1 ] );

	// we have a redundant axis
	const zRotationSign = - 1 * Math.sign( pivotAngle );
	const combinedXRotation = toAdjust[ 0 ] + zRotationSign * toAdjust[ 2 ];

	output[ 0 ] = target[ 0 ];
	output[ 1 ] = toSmallestEulerValueDistance( target[ 1 ], toAdjust[ 1 ] );
	output[ 2 ] = toSmallestEulerValueDistance( target[ 2 ], zRotationSign * ( combinedXRotation - target[ 0 ] ) );

	toSmallestEulerDistance( output, target, output );

	return true;

}

// Returns the closest euler representation
const tempEuler1 = new Float64Array( 3 );
const tempEuler2 = new Float64Array( 3 );
function getClosestEulerRepresentation( output, target, input ) {

	let score = Infinity;
	if ( isRedundantTwist( input ) ) {

		toSmallestRedundantTwistRepresentation( tempEuler1, target, input );

		// TODO: is checking the redundant direction necessary here?
		getRedundantEulerRepresentation( tempEuler2, input );
		toSmallestRedundantTwistRepresentation( tempEuler2, target, tempEuler2 );

		const d1 = diffEulerDistance( target, tempEuler1 );
		const d2 = diffEulerDistance( target, tempEuler2 );
		if ( d1 < d2 ) {

			vec3.copy( output, tempEuler1 );
			score = d1;

		} else {

			vec3.copy( output, tempEuler2 );
			score = d2;

		}

	}

	// There seems to be a chance that these representations are "closer" than the twist ones
	// in the twist case. Possibly due to numerical precision?
	toSmallestEulerDistance( tempEuler1, target, input );

	getRedundantEulerRepresentation( tempEuler2, input );
	toSmallestEulerDistance( tempEuler2, target, tempEuler2 );

	const d1 = diffEulerDistance( target, tempEuler1 );
	const d2 = diffEulerDistance( target, tempEuler2 );
	if ( d1 < score || d2 < score ) {

		if ( d1 < d2 ) {

			vec3.copy( output, tempEuler1 );

		} else {

			vec3.copy( output, tempEuler2 );

		}

	}


}

export {
	clampEulerValue,
	toSmallestEulerValueDistance,
	toSmallestEulerDistance,
	diffEulerDistance,
	getRedundantEulerRepresentation,
	toSmallestRedundantTwistRepresentation,
	getClosestEulerRepresentation,
	isRedundantTwist,
};

