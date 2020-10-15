import URDFLoader from 'urdf-loader';
import {
	Joint,
	urdfRobotToIKRoot,
	setIKFromUrdf,
} from '../src/index.js';
import { DEG2RAD } from '../src/core/utils/constants.js';
import { LoadingManager } from 'three';

export function loadATHLETE() {

	return new Promise( ( resolve, reject ) => {

		const url = 'https://raw.githubusercontent.com/gkjohnson/urdf-loaders/master/urdf/T12/urdf/T12_flipped.URDF';

		const loader = new URDFLoader();
		loader.load( url, urdf => {

			const ik = urdfRobotToIKRoot( urdf );

			// update the robot joints
			const DEG2RAD = Math.PI / 180;
			urdf.rotation.set( Math.PI / 2 , 0, 0 );
			for ( let i = 1; i <= 6 ; i ++ ) {

				urdf.joints[ `HP${ i }` ].setJointValue( 30 * DEG2RAD );
				urdf.joints[ `KP${ i }` ].setJointValue( 90 * DEG2RAD );
				urdf.joints[ `AP${ i }` ].setJointValue( -30 * DEG2RAD );

			}

			// update the degrees of freedom of the joints
			setIKFromUrdf( ik, urdf );

			// store the rest pose
			const goalMap = new Map();
			ik.traverse( c => {

				if ( c.isJoint ) {

					c.dofRestPose.set( c.dofValues );
					c.restPoseSet = true;

				} else if ( /^Foot/.test( c.name ) ) {

					const link = urdf.links[ c.name ];
					const ee = new Joint();
					ee.name = link.name;
					ee.makeClosure( c );

					c.getWorldPosition( ee.position );
					c.getWorldQuaternion( ee.quaternion );
					ee.setMatrixNeedsUpdate();

					goalMap.set( ee, c );

				}

			} );

			resolve( { ik, urdf, goalMap } );

		}, null, reject );

	} );

}

export function loadRobonaut() {

	return new Promise( ( resolve, reject ) => {

		const url = 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description/robots/r2b.urdf';
		const loader = new URDFLoader();
		loader.packages = {
			r2_description: 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description',
		};
		loader.load( url, urdf => {

			urdf.rotation.set( - Math.PI / 2, 0, 0 );

			const ik = urdfRobotToIKRoot( urdf );

			urdf.joints[ 'r2/left_leg/joint3' ].setJointValue( 60 * DEG2RAD );
			urdf.joints[ 'r2/left_leg/joint5' ].setJointValue( 60 * DEG2RAD );
			urdf.joints[ 'r2/left_arm/joint1' ].setJointValue( - 80 * DEG2RAD );
			urdf.joints[ 'r2/left_arm/joint2' ].setJointValue( - 100 * DEG2RAD );
			urdf.joints[ 'r2/left_arm/joint3' ].setJointValue( - 90 * DEG2RAD );
			urdf.joints[ 'r2/left_arm/joint4' ].setJointValue( 90 * DEG2RAD );

			urdf.joints[ 'r2/right_leg/joint3' ].setJointValue( 60 * DEG2RAD );
			urdf.joints[ 'r2/right_leg/joint5' ].setJointValue( 60 * DEG2RAD );
			urdf.joints[ 'r2/right_arm/joint1' ].setJointValue( - 80 * DEG2RAD );
			urdf.joints[ 'r2/right_arm/joint2' ].setJointValue( 100 * DEG2RAD );
			urdf.joints[ 'r2/right_arm/joint3' ].setJointValue( - 90 * DEG2RAD );
			urdf.joints[ 'r2/right_arm/joint4' ].setJointValue( - 90 * DEG2RAD );

			setIKFromUrdf( ik, urdf );

			const goalMap = new Map();
			ik.traverse( c => {

				if ( c.isJoint ) {

					c.dofRestPose.set( c.dofValues );
					c.restPoseSet = true;

				} else if (
					c.name === 'r2/left_leg_foot' ||
					c.name === 'r2/right_leg_foot'
				) {

					const link = urdf.links[ c.name ];
					const ee = new Joint();
					ee.name = link.name;
					ee.makeClosure( c );

					c.getWorldPosition( ee.position );
					c.getWorldQuaternion( ee.quaternion );
					ee.setMatrixNeedsUpdate();

					goalMap.set( ee, c );

				}

			} );

			resolve( { ik, urdf, goalMap, helperScale: 0.2 } );

		}, null, reject );

	} );

}

export function loadAthnaut() {

	return new Promise( ( resolve, reject ) => {

		let athlete, r2, url, loader;

		const manager = new LoadingManager();
		url = 'https://raw.githubusercontent.com/gkjohnson/urdf-loaders/master/urdf/T12/urdf/T12_flipped.URDF';
		loader = new URDFLoader( manager );
		loader.load( url, robot => athlete = robot, null, reject );

		url = 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description/robots/r2c5.urdf';
		loader = new URDFLoader( manager );
		loader.packages = {
			r2_description: 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description',
		};
		loader.load( url, robot => r2 = robot, null, reject );

		manager.onLoad = () => {

			const r22 = r2.clone();

			// set up first r2
			athlete.links[ 'Foot1' ].traverse( c => c.visible = ! c.isMesh );

			const r2Base = r2.joints[ 'r2/fixed/stanchion/robot_base' ];
			athlete.links[ 'Foot1' ].add( r2Base );
			r2Base.position.z = 0.15;
			r2Base.rotation.z = Math.PI;

			Object.assign( athlete.joints, r2.joints );
			Object.assign( athlete.links, r2.links );

			// set up second r2
			Object.keys( r22.links ).forEach( l => {

				r22.links[ l + '_2' ] = r22.links[ l ];
				r22.links[ l ].name = l + '_2';

				delete r22.links[ l ];

			} );
			Object.keys( r22.joints ).forEach( l => {

				r22.joints[ l + '_2' ] = r22.joints[ l ];
				r22.joints[ l ].name = l + '_2';

				delete r22.joints[ l ];

			} );

			athlete.links[ 'Foot6' ].traverse( c => c.visible = ! c.isMesh );

			const r22Base = r22.joints[ 'r2/fixed/stanchion/robot_base_2' ];
			athlete.links[ 'Foot6' ].add( r22Base );
			r22Base.position.z = 0.15;
			r22Base.rotation.z = Math.PI;

			Object.assign( athlete.joints, r22.joints );
			Object.assign( athlete.links, r22.links );


			const ik = urdfRobotToIKRoot( athlete );

			// update the robot joints
			const DEG2RAD = Math.PI / 180;
			athlete.rotation.set( Math.PI / 2 , 0, 0 );
			for ( let i = 1; i <= 6 ; i ++ ) {

				athlete.joints[ `HP${ i }` ].setJointValue( 30 * DEG2RAD );
				athlete.joints[ `KP${ i }` ].setJointValue( 90 * DEG2RAD );
				athlete.joints[ `AP${ i }` ].setJointValue( -30 * DEG2RAD );

			}

			athlete.joints[ `HP1` ].setJointValue( - 30 * DEG2RAD );
			athlete.joints[ `KP1` ].setJointValue( - 60 * DEG2RAD );
			athlete.joints[ `AP1` ].setJointValue( 0 );

			athlete.joints[ `HP6` ].setJointValue( - 30 * DEG2RAD );
			athlete.joints[ `KP6` ].setJointValue( - 60 * DEG2RAD );
			athlete.joints[ `AP6` ].setJointValue( 0 );

			athlete.joints[ `HY2` ].setJointValue( 60 * DEG2RAD );
			athlete.joints[ `HY5` ].setJointValue( - 60 * DEG2RAD );

			athlete.joints[ 'r2/left_arm/joint1' ].setJointValue( - 80 * DEG2RAD );
			athlete.joints[ 'r2/left_arm/joint2' ].setJointValue( - 100 * DEG2RAD );
			athlete.joints[ 'r2/left_arm/joint3' ].setJointValue( - 90 * DEG2RAD );
			athlete.joints[ 'r2/left_arm/joint4' ].setJointValue( 90 * DEG2RAD );

			athlete.joints[ 'r2/right_arm/joint1' ].setJointValue( - 80 * DEG2RAD );
			athlete.joints[ 'r2/right_arm/joint2' ].setJointValue( 100 * DEG2RAD );
			athlete.joints[ 'r2/right_arm/joint3' ].setJointValue( - 90 * DEG2RAD );
			athlete.joints[ 'r2/right_arm/joint4' ].setJointValue( - 90 * DEG2RAD );

			athlete.joints[ 'r2/left_arm/joint1_2' ].setJointValue( - 80 * DEG2RAD );
			athlete.joints[ 'r2/left_arm/joint2_2' ].setJointValue( - 100 * DEG2RAD );
			athlete.joints[ 'r2/left_arm/joint3_2' ].setJointValue( - 90 * DEG2RAD );
			athlete.joints[ 'r2/left_arm/joint4_2' ].setJointValue( 90 * DEG2RAD );

			athlete.joints[ 'r2/right_arm/joint1_2' ].setJointValue( - 80 * DEG2RAD );
			athlete.joints[ 'r2/right_arm/joint2_2' ].setJointValue( 100 * DEG2RAD );
			athlete.joints[ 'r2/right_arm/joint3_2' ].setJointValue( - 90 * DEG2RAD );
			athlete.joints[ 'r2/right_arm/joint4_2' ].setJointValue( - 90 * DEG2RAD );

			setIKFromUrdf( ik, athlete );

			const goalMap = new Map();
			ik.traverse( c => {

				if ( c.isJoint ) {

					c.dofRestPose.set( c.dofValues );
					c.restPoseSet = true;

				} else if ( /^Foot/.test( c.name ) ) {

					const link = athlete.links[ c.name ];
					const ee = new Joint();
					ee.name = link.name;
					ee.makeClosure( c );

					c.getWorldPosition( ee.position );
					c.getWorldQuaternion( ee.quaternion );
					ee.setMatrixNeedsUpdate();

					goalMap.set( ee, c );

				}

			} );

			resolve( { ik, urdf: athlete, goalMap, helperScale: 0.2 } );

		};

	} );

}
