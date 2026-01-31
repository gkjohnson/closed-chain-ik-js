import { quat } from 'gl-matrix';
import { smallestDifferenceQuaternion } from '../../../src/core/utils/quaternion.js';
import { PI, PI2, HALF_PI, RAD2DEG } from '../../../src/core/utils/constants.js';

import {
	clampEulerValue,
	toSmallestEulerValueDistance,
	diffEulerDistance,
	getRedundantEulerRepresentation,
	toSmallestRedundantTwistRepresentation,
	isRedundantTwist,
	toSmallestEulerDistance,
	getClosestEulerRepresentation,
} from '../../../src/core/utils/euler.js';

function compare( a, b ) {

	const qa = new Array( 4 );
	const qb = new Array( 4 );
	const delta = new Array( 4 );

	quat.fromEuler( qa, a[ 0 ] * RAD2DEG, a[ 1 ] * RAD2DEG, a[ 2 ] * RAD2DEG );
	quat.fromEuler( qb, b[ 0 ] * RAD2DEG, b[ 1 ] * RAD2DEG, b[ 2 ] * RAD2DEG );

	smallestDifferenceQuaternion( delta, qa, qb );

	expect( Math.abs( delta[ 0 ] ) ).toBeLessThan( 1e-7 );
	expect( Math.abs( delta[ 1 ] ) ).toBeLessThan( 1e-7 );
	expect( Math.abs( delta[ 2 ] ) ).toBeLessThan( 1e-7 );
	expect( Math.abs( delta[ 3 ] ) ).toBeLessThan( 1e-7 );

}

describe( 'clampEulerValue', () => {

	it( 'should clamp the angle to ( -PI, PI ].', () => {

		expect( clampEulerValue( PI ) ).toEqual( PI );
		expect( clampEulerValue( - PI ) ).toEqual( PI );
		expect( clampEulerValue( 3 * PI ) ).toEqual( PI );
		for ( let i = 0; i < 100; i ++ ) {

			const angle = ( Math.random() - 0.5 ) * 2 * PI * 10;
			const clampedAngle = clampEulerValue( angle );

			expect( clampedAngle ).toBeLessThanOrEqual( PI );
			expect( clampedAngle ).toBeGreaterThan( - PI );

			compare( [ 0, 0, angle ], [ 0, 0, clampedAngle ] );
			compare( [ 0, angle, 0 ], [ 0, clampedAngle, 0 ] );
			compare( [ angle, 0, 0 ], [ clampedAngle, 0, 0 ] );

		}

	} );

} );

describe( 'toSmallestEulerValueDistance', () => {

	it( 'should find the smallest distance to the given target.', () => {

		expect( toSmallestEulerValueDistance( 0, PI ) ).toEqual( PI );
		expect( toSmallestEulerValueDistance( 0, PI + 1 ) ).toEqual( - PI + 1 );
		expect( Math.abs( toSmallestEulerValueDistance( 0, PI + 5 * PI2 ) - PI ) ).toBeLessThan( 1e-7 );

		expect( toSmallestEulerValueDistance( - PI - 1, PI ) ).toEqual( - PI );
		expect( Math.abs( toSmallestEulerValueDistance( - PI - 1, PI + 5 * PI2 ) + PI ) ).toBeLessThan( 1e-7 );

		expect( toSmallestEulerValueDistance( PI + 1, - PI ) ).toEqual( PI );
		expect( Math.abs( toSmallestEulerValueDistance( PI - 1, - PI - 5 * PI2 ) - PI ) ).toBeLessThan( 1e-7 );

		expect( toSmallestEulerValueDistance( 10 * PI, - PI / 2 ) ).toEqual( 9.5 * PI );
		expect( toSmallestEulerValueDistance( - 10 * PI, - PI / 2 ) ).toEqual( - 10.5 * PI );

	} );

} );

describe( 'diffEulerDistance', () => {

	it( 'should return the manhatten distance between to two vectors of euler angles.', () => {

		expect( diffEulerDistance( [ 0, 1, 0 ], [ 0, - 1, 0 ] ) ).toEqual( 2 );
		expect( diffEulerDistance( [ 1, 1, 0 ], [ 1, - 1, 0 ] ) ).toEqual( 2 );
		expect( diffEulerDistance( [ 1, 1, 1 ], [ 1, - 1, - 1 ] ) ).toEqual( 4 );

	} );


} );

describe( 'getRedundantEulerRepresentation', () => {

	it( 'should convert the euler angles to a minimal representation.', () => {

		for ( let i = 0; i < 100; i ++ ) {

			const euler = [
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
			];

			const redundant = new Array( 3 );
			getRedundantEulerRepresentation( redundant, euler );

			compare( euler, redundant );

		}

	} );

} );

describe( 'toSmallestRedundantTwistRepresentation', () => {

	it( 'should return false if input is not a redundant twist representation.', () => {

		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, 0, 0 ] ) ).toBeFalsy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 100, 0, - 10 ] ) ).toBeFalsy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ - 10, 0, 10 ] ) ).toBeFalsy();

		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, HALF_PI - 0.1, 0 ] ) ).toBeFalsy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, HALF_PI + 0.1, 0 ] ) ).toBeFalsy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, - HALF_PI - 0.1, 0 ] ) ).toBeFalsy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, - HALF_PI + 0.1, 0 ] ) ).toBeFalsy();

		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, HALF_PI, 0 ] ) ).toBeTruthy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, - HALF_PI, 0 ] ) ).toBeTruthy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, PI2 + HALF_PI, 0 ] ) ).toBeTruthy();
		expect( toSmallestRedundantTwistRepresentation( [], [], [ 0, - PI2 - HALF_PI, 0 ] ) ).toBeTruthy();

	} );

	it( 'should convert to a closest twist representation.', () => {

		let a, b, output = new Array( 3 );

		a = [ 10, HALF_PI, 10 ];
		b = [ 10, HALF_PI, 10 ];
		toSmallestRedundantTwistRepresentation( output, a, b );
		expect( output ).toEqual( [ 10, HALF_PI, 10 ] );

		a = [ 10, HALF_PI, 10 ];
		b = [ 10 - PI2, HALF_PI, 10 + PI2 ];
		toSmallestRedundantTwistRepresentation( output, a, b );
		expect( output ).toEqual( [ 10, HALF_PI, 10 ] );

		a = [ 10, 0, 10 ];
		b = [ 10, HALF_PI, 10 ];
		toSmallestRedundantTwistRepresentation( output, a, b );
		expect( output ).toEqual( [ 10, HALF_PI, 10 ] );

		a = [ 10, - HALF_PI, 10 ];
		b = [ 10, HALF_PI, 10 ];
		toSmallestRedundantTwistRepresentation( output, a, b );
		expect( output ).toEqual( [ 10, HALF_PI, 10 ] );

		for ( let i = 0; i < 100; i ++ ) {

			const a = [
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
			];

			const b = [
				( Math.random() - 0.5 ) * 360 * 2,
				Math.sign( Math.random() - 0.5 ) * HALF_PI,
				( Math.random() - 0.5 ) * 360 * 2,
			];

			expect( toSmallestRedundantTwistRepresentation( output, a, b ) ).toBeTruthy();

			expect( Math.abs( output[ 0 ] - a[ 0 ] ) ).toBeLessThanOrEqual( PI );
			expect( Math.abs( output[ 1 ] - a[ 1 ] ) ).toBeLessThanOrEqual( PI );
			expect( Math.abs( output[ 2 ] - a[ 2 ] ) ).toBeLessThanOrEqual( PI );

			compare( b, output );

		}

	} );

} );

describe( 'getClosestEulerRepresentation', () => {

	it( 'should return the closest of the euler representations.', () => {

		for ( let i = 0; i < 100; i ++ ) {

			const a = [
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
			];

			const b = [
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
				( Math.random() - 0.5 ) * 360 * 2,
			];

			if ( i % 4 === 1 ) {

				a[ 1 ] = Math.sign( Math.random() - 0.5 ) * HALF_PI;

			} else if ( i % 4 === 2 ) {

				b[ 1 ] = Math.sign( Math.random() - 0.5 ) * HALF_PI;

			} else if ( i % 4 === 3 ) {

				a[ 1 ] = Math.sign( Math.random() - 0.5 ) * HALF_PI;
				b[ 1 ] = Math.sign( Math.random() - 0.5 ) * HALF_PI;

			}

			const results = [];

			if ( isRedundantTwist( b ) ) {

				const res1 = new Float64Array( 3 );
				toSmallestRedundantTwistRepresentation( res1, a, b );

				const res2 = new Float64Array( 3 );
				getRedundantEulerRepresentation( res2, b );
				toSmallestRedundantTwistRepresentation( res2, a, res2 );

				results.push( res1, res2 );

			}

			const res3 = new Float64Array( 3 );
			toSmallestEulerDistance( res3, a, b );

			const res4 = new Float64Array( 3 );
			getRedundantEulerRepresentation( res4, b );
			toSmallestEulerDistance( res4, a, res4 );

			results.push( res3, res4 );

			results.sort( ( ra, rb ) => diffEulerDistance( a, ra ) - diffEulerDistance( a, rb ) );

			for ( let i = 0; i < results.length; i ++ ) {

				for ( let j = 0; j < results.length; j ++ ) {

					compare( results[ i ], results[ j ] );

				}

			}

			const output = new Float64Array( 3 );
			getClosestEulerRepresentation( output, a, b );

			expect( output ).toEqual( results[ 0 ] );

		}

	} );


} );
