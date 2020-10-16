import { randomizeFrame } from './utils.js';
import { Joint } from '../../src/core/Joint.js';
import { Link } from '../../src/core/Link.js';
import { copyBufferToFrame, copyFrameToBuffer, applyFromBuffer, applyToBuffer, JOINT_STRIDE } from '../../src/worker/utils.js';

describe( 'copyBufferToFrame / copyFrameToBuffer', () => {

	it( 'should copy joint state into the buffer and back out.', () => {

		const buffer = new ArrayBuffer( JOINT_STRIDE );
		const floatBuffer = new Float32Array( buffer );
		const byteBuffer = new Uint8Array( buffer );
		const joint = new Joint();
		randomizeFrame( joint );
		copyFrameToBuffer( joint, floatBuffer, byteBuffer, 0 );

		const otherJoint = new Joint();
		randomizeFrame( otherJoint );
		copyBufferToFrame( otherJoint, floatBuffer, byteBuffer, 0 );

		expect( joint ).toEqual( otherJoint );

	} );

	it( 'should copy link state into the buffer and back out.', () => {

		const buffer = new ArrayBuffer( JOINT_STRIDE );
		const floatBuffer = new Float64Array( buffer );
		const byteBuffer = new Uint8Array( buffer );
		const link = new Link();
		randomizeFrame( link );
		copyFrameToBuffer( link, floatBuffer, byteBuffer, 0 );

		const otherLink = new Link();
		randomizeFrame( otherLink );
		copyBufferToFrame( otherLink, floatBuffer, byteBuffer, 0 );

		expect( link ).toEqual( otherLink );

	} );

	it( 'should work with non zero offsets.', () => {

		const buffer = new ArrayBuffer( 2 * JOINT_STRIDE );
		const floatBuffer = new Float32Array( buffer );
		const byteBuffer = new Uint8Array( buffer );
		floatBuffer.fill( 0 );

		const joint = new Joint();
		randomizeFrame( joint );
		copyFrameToBuffer( joint, floatBuffer, byteBuffer, JOINT_STRIDE );

		const otherJoint = new Joint();
		randomizeFrame( otherJoint );
		copyBufferToFrame( otherJoint, floatBuffer, byteBuffer, JOINT_STRIDE );

		expect( joint ).toEqual( otherJoint );
		expect( floatBuffer[ 0 ] ).toEqual( 0 );
		expect( floatBuffer[ JOINT_STRIDE / 4 ] ).toEqual( joint.position[ 0 ] );

	} );

} );

describe( 'applyToBuffer / applyFromBuffer', () => {

	it( 'should copy across a whole list.', () => {

		const buffer = new ArrayBuffer( 100 * JOINT_STRIDE );
		const floatBuffer = new Float32Array( buffer );
		const byteBuffer = new Uint8Array( buffer );

		const list = new Array( 100 )
			.fill()
			.map( ( v, i ) => i % 2 === 0 ? new Joint() : new Link() );
		list.forEach( randomizeFrame );

		const otherList = new Array( 100 )
			.fill()
			.map( ( v, i ) => i % 2 === 0 ? new Joint() : new Link() );
		otherList.forEach( randomizeFrame );

		applyToBuffer( list, floatBuffer, byteBuffer );
		applyFromBuffer( otherList, floatBuffer, byteBuffer );

		expect( otherList ).toEqual( list );

	} );

} );
