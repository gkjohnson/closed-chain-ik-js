import URDFLoader from 'urdf-loader';
import {
	Joint,
	urdfRobotToIKRoot,
	setIKFromUrdf,
} from '../src/index.js';
import { DEG2RAD } from '../src/core/utils/constants.js';
import { LoadingManager } from 'three';
import { XacroLoader } from 'xacro-parser';
import { quat } from 'gl-matrix';

export function loadCuriosity() {

	return new Promise( ( resolve, reject ) => {

		const url = 'https://raw.githubusercontent.com/gkjohnson/curiosity_mars_rover-mirror/master/curiosity_mars_rover_description/urdf/curiosity_mars_rover.xacro';
		const xacroLoader = new XacroLoader();
		xacroLoader.rospackCommands = {

			find( pkg ) {

				switch ( pkg ) {

					case 'curiosity_mars_rover_description':
						return 'https://raw.githubusercontent.com/gkjohnson/curiosity_mars_rover-mirror/master/curiosity_mars_rover_description/';
					default:
						return pkg;

				}

			}

		};

		xacroLoader.load( url, xacro => {

			let ik, urdf, goalMap;

			const manager = new LoadingManager();
			manager.onLoad = () => {

				const toRemove = [];
				urdf.traverse( c => {

					if ( c.isLight || c.isLineSegments ) {

						toRemove.push( c );

					}

				} );

				toRemove.forEach( l => {

					l.parent.remove( l );

				} );

				resolve( { ik, urdf, goalMap, helperScale: 0.3 } );

			};

			const urdfLoader = new URDFLoader( manager );
			urdfLoader.packages = {
				'curiosity_mars_rover_description': 'https://raw.githubusercontent.com/gkjohnson/curiosity_mars_rover-mirror/master/curiosity_mars_rover_description/'
			};
			urdf = urdfLoader.parse( xacro );
			urdf.joints.arm_03_joint.limit.upper = Math.PI * 3 / 2;
			ik = urdfRobotToIKRoot( urdf );

			// make the root fixed
			ik.clearDoF();
			quat.fromEuler( ik.quaternion, - 90, 0, 0 );
			ik.position[ 1 ] -= 0.5;
			ik.setMatrixNeedsUpdate();

			// start the joints off at reasonable angles
			urdf.setJointValue( 'arm_02_joint', - Math.PI / 2 );
			urdf.setJointValue( 'arm_03_joint', Math.PI );
			urdf.setJointValue( 'arm_04_joint', Math.PI );
			// urdf.setJointValue( 'joint_5', - Math.PI / 4 );
			setIKFromUrdf( ik, urdf );

			goalMap = new Map();
			const tool = ik.find( l => l.name === 'arm_tools' );
			const link = urdf.links.arm_tools;

			const ee = new Joint();
			ee.name = link.name;
			ee.makeClosure( tool );

			tool.getWorldPosition( ee.position );
			tool.getWorldQuaternion( ee.quaternion );
			ee.setMatrixNeedsUpdate();
			goalMap.set( ee, tool );

		}, reject );

	} );

}

export function loadStaubli() {

	return new Promise( ( resolve, reject ) => {

		const url = 'https://raw.githubusercontent.com/ros-industrial/staubli_experimental/ce422fe0a54232d73cf44e2571fc7abc2f5ff9f6/staubli_tx2_90_support/urdf/tx2_90.xacro';
		const xacroLoader = new XacroLoader();
		xacroLoader.rospackCommands = {

			find( pkg ) {

				switch ( pkg ) {

					case 'staubli_resources':
						return 'https://raw.githubusercontent.com/ros-industrial/staubli/indigo-devel/staubli_resources/';
					case 'staubli_tx2_90_support':
						return 'https://raw.githubusercontent.com/ros-industrial/staubli_experimental/ce422fe0a54232d73cf44e2571fc7abc2f5ff9f6/staubli_tx2_90_support/';
					default:
						return pkg;

				}

			}

		};

		xacroLoader.load( url, xacro => {

			let ik, urdf, goalMap;

			const manager = new LoadingManager();
			manager.onLoad = () => {

				resolve( { ik, urdf, goalMap, helperScale: 0.3 } );

			};

			const urdfLoader = new URDFLoader( manager );
			urdfLoader.packages = {
				'staubli_tx2_90_support': 'https://raw.githubusercontent.com/ros-industrial/staubli_experimental/ce422fe0a54232d73cf44e2571fc7abc2f5ff9f6/staubli_tx2_90_support/'
			};
			urdf = urdfLoader.parse( xacro );
			ik = urdfRobotToIKRoot( urdf );

			// make the root fixed
			ik.clearDoF();
			quat.fromEuler( ik.quaternion, - 90, 0, 0 );
			ik.position[ 1 ] -= 0.5;
			ik.setMatrixNeedsUpdate();

			// start the joints off at reasonable angles
			urdf.setJointValue( 'joint_2', Math.PI / 4 );
			urdf.setJointValue( 'joint_3', Math.PI / 2 );
			urdf.setJointValue( 'joint_5', - Math.PI / 4 );
			setIKFromUrdf( ik, urdf );

			goalMap = new Map();
			const tool = ik.find( l => l.name === 'tool0' );
			const link = urdf.links.tool0;

			const ee = new Joint();
			ee.name = link.name;
			ee.makeClosure( tool );

			tool.getWorldPosition( ee.position );
			tool.getWorldQuaternion( ee.quaternion );
			ee.setMatrixNeedsUpdate();
			goalMap.set( ee, tool );

		}, reject );

	} );

}

export function loadATHLETE() {

	return new Promise( ( resolve, reject ) => {

		let ik, urdf, goalMap;
		const manager = new LoadingManager();
		manager.onLoad = () => {

			resolve( { ik, urdf, goalMap } );

		};

		const url = 'https://raw.githubusercontent.com/gkjohnson/urdf-loaders/master/urdf/T12/urdf/T12_flipped.URDF';

		const loader = new URDFLoader( manager );
		loader.load( url, result => {

			urdf = result;
			ik = urdfRobotToIKRoot( urdf );

			// update the robot joints
			const DEG2RAD = Math.PI / 180;
			urdf.rotation.set( Math.PI / 2, 0, 0 );
			for ( let i = 1; i <= 6; i ++ ) {

				urdf.joints[ `HP${ i }` ].setJointValue( 30 * DEG2RAD );
				urdf.joints[ `KP${ i }` ].setJointValue( 90 * DEG2RAD );
				urdf.joints[ `AP${ i }` ].setJointValue( - 30 * DEG2RAD );

			}

			// update the degrees of freedom of the joints
			setIKFromUrdf( ik, urdf );

			// store the rest pose
			goalMap = new Map();
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

		}, null, reject );

	} );

}

export function loadRobonaut() {

	return new Promise( ( resolve, reject ) => {

		let urdf, ik, goalMap;
		const manager = new LoadingManager();
		manager.onLoad = () => {

			convertColorsAndTextures( urdf );

			resolve( { ik, urdf, goalMap, helperScale: 0.2 } );

		};

		const url = 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description/robots/r2b.urdf';
		const loader = new URDFLoader( manager );
		loader.packages = {
			r2_description: 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description',
		};
		loader.load( url, result => {

			urdf = result;
			urdf.rotation.set( - Math.PI / 2, 0, 0 );

			ik = urdfRobotToIKRoot( urdf );

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

			goalMap = new Map();
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
			athlete.rotation.set( Math.PI / 2, 0, 0 );
			for ( let i = 1; i <= 6; i ++ ) {

				athlete.joints[ `HP${ i }` ].setJointValue( 30 * DEG2RAD );
				athlete.joints[ `KP${ i }` ].setJointValue( 90 * DEG2RAD );
				athlete.joints[ `AP${ i }` ].setJointValue( - 30 * DEG2RAD );

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
