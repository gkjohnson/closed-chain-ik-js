import { Link } from '../../src/core/Link.js';
import { Joint } from '../../src/core/Joint.js';
import { serialize, deserialize } from '../../src/worker/serialize.js';
import { randomizeFrame } from './utils.js';

describe( 'serialize / deserialize', () => {

	it ( 'should serialize to different arrays.', () => {

		const joint = new Joint();
		const link = new Link();

		joint.addChild( link );

		const serialized = serialize( [ joint, link ] );

		expect( serialized ).toHaveLength( 2 );
		expect( serialized[ 0 ].type ).toEqual( 'Joint' );
		expect( serialized[ 1 ].type ).toEqual( 'Link' );

		const js = serialized[ 0 ];
		expect( js.position ).not.toBe( joint.position );
		expect( js.quaternion ).not.toBe( joint.quaternion );
		expect( js.dofValues ).not.toBe( joint.dofValues );
		expect( js.dofTarget ).not.toBe( joint.dofTarget );
		expect( js.dofRestPose ).not.toBe( joint.dofRestPose );
		expect( js.dof ).not.toBe( joint.dof );
		expect( js.children ).toEqual( [ 1 ] );
		expect( js.parent ).toEqual( null );

		const ls = serialized[ 1 ];

		expect( ls.parent ).toEqual( 0 );
		expect( ls.children ).toEqual( [] );

	} );

	it ( 'should deserialize to the same list.', () => {

		const joint = new Joint();
		const link = new Link();
		joint.updateMatrixWorld();
		link.updateMatrixWorld();

		const serialized = serialize( [ joint, link ] );
		const deserialized = deserialize( serialized );
		deserialized[ 0 ].updateMatrixWorld();
		deserialized[ 1 ].updateMatrixWorld();

		expect( joint ).toEqual( deserialized[ 0 ] );
		expect( link ).toEqual( deserialized[ 1 ] );

	} );

	it ( 'should deserialize to the same structure.', () => {

		const joint = new Joint();
		const link = new Link();
		joint.addChild( link );
		joint.updateMatrixWorld( true );

		const serialized = serialize( [ joint, link ] );
		const deserialized = deserialize( serialized );

		const [ js, ls ] = deserialized;
		js.updateMatrixWorld( true );

		expect( js.parent ).toEqual( null );
		expect( js.children ).toEqual( [ ls ] );
		expect( js.child ).toEqual( ls );

		expect( ls.parent ).toEqual( js );
		expect( ls.children ).toEqual( [] );

		expect( js ).toEqual( joint );

	} );

	// See issue #9
	// it ( 'should be able to deserialize a cyclic structure.', () => {

	// 	const l1 = new Link();
	// 	const j1 = new Joint();
	// 	const l2 = new Link();
	// 	const j2 = new Joint();

	// 	l1.addChild( j1 );
	// 	j1.addChild( l2 );
	// 	l2.addChild( j2 );
	// 	j2.addChild( l1 );

	// 	l1.updateMatrixWorld( true );

	// 	const serialized = serialize( [ l1, j1, l2, j2 ] );
	// 	const deserialized = deserialize( serialized );
	// 	deserialized.forEach( f => f.updateMatrixWorld() );

	// 	expect( deserialized ).toEqual( [ l1, j1, l2, j2 ] );

	// } );

	it ( 'should be able to deserialize a closure structure.', () => {

		const l1 = new Link();
		const j1 = new Joint();
		const l2 = new Link();
		const j2 = new Joint();

		l1.addChild( j1 );
		j1.addChild( l2 );
		j2.addChild( l2 );

		l1.updateMatrixWorld( true );

		const serialized = serialize( [ l1, j1, l2, j2 ] );
		const deserialized = deserialize( serialized );
		deserialized.forEach( f => f.updateMatrixWorld() );

		expect( deserialized ).toEqual( [ l1, j1, l2, j2 ] );
		expect( deserialized[ 3 ].isClosure ).toBeTruthy();

	} );

	it ( 'should be able to deserialize a deep structure.', () => {

		const list = [];
		const root = generate( 3, 4 );
		root.traverse( c => {

			list.push( c );

		} );

		const serialized = serialize( list );
		const deserialized = deserialize( serialized );

		expect( deserialized ).toEqual( list );

		function generate( breadth, depth ) {

			const j = new Joint();
			randomizeFrame( j );

			const l = new Link;
			randomizeFrame( l );

			j.addChild( l );

			if ( depth - 1 !== 0 ) {

				for ( let j = 0; j < breadth; j ++ ) {

					const j2 = generate( breadth, depth - 1 );
					l.addChild( j2 );

				}

			}

			return j;

		}

	} );

} );
