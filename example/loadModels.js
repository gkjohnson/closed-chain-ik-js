import URDFLoader from 'urdf-loader';
import {
	URDFUtils,
	IKUtils,
	Goal,
} from '../src/index.js';
import { DEG2RAD } from '../src/core/utils/constants.js';
import { LoadingManager } from 'three';
import { XacroLoader } from 'xacro-parser';
import { quat } from 'gl-matrix';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// Helper to promisify XacroLoader
const rospackCommands = {
	optenv( field, def ) {

		return field === 'SPOT_ARM' ? 1 : def;

	},
	find( pkg ) {

		switch ( pkg ) {

			case 'r2_description':
				return 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description';
			case 'staubli_resources':
				return 'https://raw.githubusercontent.com/ros-industrial/staubli/indigo-devel/staubli_resources/';
			case 'staubli_tx2_90_support':
				return 'https://raw.githubusercontent.com/ros-industrial/staubli_experimental/ce422fe0a54232d73cf44e2571fc7abc2f5ff9f6/staubli_tx2_90_support/';
			case 'spot_description':
				return 'https://raw.githubusercontent.com/heuristicus/spot_ros/refs/heads/master/spot_description/';
			case 'curiosity_mars_rover_description':
				return 'https://raw.githubusercontent.com/gkjohnson/curiosity_mars_rover-mirror/master/curiosity_mars_rover_description/';
			default:
				return pkg;

		}

	},

};

function loadXacro( url ) {

	return new Promise( ( resolve, reject ) => {

		const loader = new XacroLoader();
		loader.rospackCommands = rospackCommands;
		loader.load( url, resolve, reject );

	} );

}

// Helper to wait for LoadingManager to finish
function waitForManager( manager ) {

	return new Promise( resolve => {

		manager.onLoad = resolve;

	} );

}

function cleanGeometry( root ) {

	const toRemove = [];
	root.traverse( c => {

		if ( c.isLight || c.isLineSegments ) {

			toRemove.push( c );

		}

	} );

	toRemove.forEach( c => {

		c.removeFromParent();

	} );

}

export async function loadCuriosity() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// load xacro
	const url = 'https://raw.githubusercontent.com/gkjohnson/curiosity_mars_rover-mirror/master/curiosity_mars_rover_description/urdf/curiosity_mars_rover.xacro';
	const xacro = await loadXacro( url );

	// parse urdf
	const urdfLoader = new URDFLoader( manager );
	urdfLoader.packages = rospackCommands.find;

	const urdf = urdfLoader.parse( xacro );
	urdf.joints.arm_03_joint.limit.upper = Math.PI * 3 / 2;
	urdf.rotation.set( - Math.PI / 2, 0, 0 );
	urdf.position.y -= 0.5;
	urdf.setJointValue( 'arm_02_joint', - Math.PI / 2 );
	urdf.setJointValue( 'arm_03_joint', Math.PI );
	urdf.setJointValue( 'arm_04_joint', Math.PI );

	// ik & make the root fixed
	const ik = URDFUtils.urdfRobotToIKRoot( urdf );
	URDFUtils.setIKFromUrdf( ik, urdf );
	IKUtils.saveRestPose( ik );
	ik.clearDoF();

	// construct goals
	const goalMap = new Map();
	const tool = ik.find( l => l.name === 'arm_tools' );
	const link = urdf.links.arm_tools;

	const ee = new Goal();
	ee.name = link.name;
	ee.makeClosure( tool );

	tool.getWorldPosition( ee.position );
	tool.getWorldQuaternion( ee.quaternion );
	ee.setMatrixNeedsUpdate();
	goalMap.set( ee, tool );

	await managerReady;
	cleanGeometry( urdf );

	return { ik, urdf, goalMap, helperScale: 0.3 };

}

export async function loadDigit() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// load urdf
	const url = 'https://raw.githubusercontent.com/adubredu/DigitRobot.jl/refs/heads/main/urdf/digit_model.urdf';
	const urdfLoader = new URDFLoader( manager );
	urdfLoader.loadMeshCb = ( url, manager, done ) => {

		new MTLLoader( manager )
			.loadAsync( url.replace( /.obj$/, '.mtl' ) )
			.then( mtl => {

				mtl.preload();
				new OBJLoader( manager )
					.setMaterials( mtl )
					.loadAsync( url )
					.then( done );

			} );

	};

	urdfLoader.packages = 'https://raw.githubusercontent.com/adubredu/DigitRobot.jl/refs/heads/main/urdf';

	const urdf = await urdfLoader.loadAsync( url );
	urdf.rotation.set( - Math.PI / 2, 0, 0 );
	urdf.setJointValue( 'hip_abduction_right', - 0.3 );
	urdf.setJointValue( 'toe_pitch_joint_right', 0.1 );
	urdf.setJointValue( 'hip_abduction_left', 0.3 );
	urdf.setJointValue( 'toe_pitch_joint_left', - 0.1 );

	// ik & make the root fixed
	const ik = URDFUtils.urdfRobotToIKRoot( urdf );
	URDFUtils.setIKFromUrdf( ik, urdf );
	IKUtils.saveRestPose( ik );

	// create goals
	const goalMap = new Map();
	[ 'torso', 'left_toe_pitch', 'right_toe_pitch' ].forEach( name => {

		const link = ik.find( l => l.name === name );
		const goal = new Goal();
		link.getWorldPosition( goal.position );
		link.getWorldQuaternion( goal.quaternion );
		goal.makeClosure( link );
		goalMap.set( goal, link );

	} );

	await managerReady;
	cleanGeometry( urdf );

	return { ik, urdf, goalMap, helperScale: 0.3 };

}

export async function loadSpot() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// xacro
	const url = 'https://raw.githubusercontent.com/heuristicus/spot_ros/refs/heads/master/spot_description/urdf/spot.urdf.xacro';
	const xacro = await loadXacro( url );

	// urdf
	const urdfLoader = new URDFLoader( manager );
	urdfLoader.packages = rospackCommands.find;

	const urdf = urdfLoader.parse( xacro );
	urdf.setJointValue( 'arm_joint1', Math.PI / 2 );
	urdf.setJointValue( 'arm_joint2', - Math.PI / 2 );
	urdf.setJointValue( 'arm_joint3', Math.PI / 2 );
	urdf.rotation.set( - Math.PI / 2, 0, 0 );

	// load ik and initialize positions
	const ik = URDFUtils.urdfRobotToIKRoot( urdf );
	URDFUtils.setIKFromUrdf( ik, urdf );
	IKUtils.saveRestPose( ik );

	// create goals
	const goalMap = new Map();
	[ 'gripper', 'body' ].forEach( name => {

		const link = ik.find( l => l.name === name );
		const goal = new Goal();
		link.getWorldPosition( goal.position );
		link.getWorldQuaternion( goal.quaternion );
		goal.makeClosure( link );
		goalMap.set( goal, link );

	} );

	await managerReady;
	cleanGeometry( urdf );

	return { ik, urdf, goalMap, helperScale: 0.3 };

}

export async function loadStaubli() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// xacro
	const url = 'https://raw.githubusercontent.com/ros-industrial/staubli_experimental/ce422fe0a54232d73cf44e2571fc7abc2f5ff9f6/staubli_tx2_90_support/urdf/tx2_90.xacro';
	const xacro = await loadXacro( url );

	// urdf
	const urdfLoader = new URDFLoader( manager );
	urdfLoader.packages = rospackCommands.find;

	const urdf = urdfLoader.parse( xacro );
	urdf.setJointValue( 'joint_2', Math.PI / 4 );
	urdf.setJointValue( 'joint_3', Math.PI / 2 );
	urdf.setJointValue( 'joint_5', - Math.PI / 4 );
	urdf.rotation.set( - Math.PI / 2, 0, 0 );
	urdf.position.y -= 0.5;

	// ik & make root fixed
	const ik = URDFUtils.urdfRobotToIKRoot( urdf );
	ik.clearDoF();
	URDFUtils.setIKFromUrdf( ik, urdf );
	IKUtils.saveRestPose( ik );

	// goals
	const goalMap = new Map();
	const tool = ik.find( l => l.name === 'tool0' );
	const link = urdf.links.tool0;

	const ee = new Goal();
	ee.name = link.name;
	ee.makeClosure( tool );

	tool.getWorldPosition( ee.position );
	tool.getWorldQuaternion( ee.quaternion );
	ee.setMatrixNeedsUpdate();
	goalMap.set( ee, tool );

	await managerReady;
	cleanGeometry( urdf );

	return { ik, urdf, goalMap, helperScale: 0.3 };

}

export async function loadATHLETE() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// load urdf
	const url = 'https://raw.githubusercontent.com/gkjohnson/urdf-loaders/master/urdf/T12/urdf/T12_flipped.URDF';
	const loader = new URDFLoader( manager );
	const urdf = await loader.loadAsync( url );

	// update the robot joints
	urdf.rotation.set( Math.PI / 2, 0, 0 );
	for ( let i = 1; i <= 6; i ++ ) {

		urdf.joints[ `HP${ i }` ].setJointValue( 30 * DEG2RAD );
		urdf.joints[ `KP${ i }` ].setJointValue( 90 * DEG2RAD );
		urdf.joints[ `AP${ i }` ].setJointValue( - 30 * DEG2RAD );

	}

	// set up ik
	const ik = URDFUtils.urdfRobotToIKRoot( urdf );
	URDFUtils.setIKFromUrdf( ik, urdf );
	IKUtils.saveRestPose( ik );

	// init goals
	const goalMap = new Map();
	ik.traverse( c => {

		if ( /^Foot/.test( c.name ) ) {

			const link = urdf.links[ c.name ];
			const ee = new Goal();
			ee.name = link.name;
			ee.makeClosure( c );

			c.getWorldPosition( ee.position );
			c.getWorldQuaternion( ee.quaternion );
			ee.setMatrixNeedsUpdate();

			goalMap.set( ee, c );

		}

	} );

	await managerReady;
	cleanGeometry( urdf );

	return { ik, urdf, goalMap };

}

export async function loadRobonaut() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// load urdf
	const url = 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description/robots/r2b.urdf';
	const loader = new URDFLoader( manager );
	loader.packages = rospackCommands.find;

	const urdf = await loader.loadAsync( url );
	urdf.rotation.set( - Math.PI / 2, 0, 0 );
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

	// init ik
	const ik = URDFUtils.urdfRobotToIKRoot( urdf );
	URDFUtils.setIKFromUrdf( ik, urdf );
	IKUtils.saveRestPose( ik );

	// goals
	const goalMap = new Map();
	ik.traverse( c => {

		if ( c.name === 'r2/left_leg_foot' || c.name === 'r2/right_leg_foot' ) {

			const link = urdf.links[ c.name ];
			const ee = new Goal();
			ee.name = link.name;
			ee.makeClosure( c );

			c.getWorldPosition( ee.position );
			c.getWorldQuaternion( ee.quaternion );
			ee.setMatrixNeedsUpdate();

			goalMap.set( ee, c );

		}

	} );

	await managerReady;
	cleanGeometry( urdf );

	return { ik, urdf, goalMap, helperScale: 0.2 };

}

export async function loadAthnaut() {

	// manager
	const manager = new LoadingManager();
	const managerReady = waitForManager( manager );

	// load urdfs
	const url1 = 'https://raw.githubusercontent.com/gkjohnson/urdf-loaders/master/urdf/T12/urdf/T12_flipped.URDF';
	const url2 = 'https://raw.githubusercontent.com/gkjohnson/nasa-urdf-robots/master/r2_description/robots/r2c5.urdf';

	const loader1 = new URDFLoader( manager );
	const loader2 = new URDFLoader( manager );
	loader2.packages = rospackCommands.find;

	const [ athlete, r2 ] = await Promise.all( [
		loader1.loadAsync( url1 ),
		loader2.loadAsync( url2 ),
	] );

	await managerReady;

	// joint the urdf structures together
	// create a second r2
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

	// update the robot joints
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

	// init the ik
	const ik = URDFUtils.urdfRobotToIKRoot( athlete );
	URDFUtils.setIKFromUrdf( ik, athlete );
	IKUtils.saveRestPose( ik );

	// create goals
	const goalMap = new Map();
	ik.traverse( c => {

		if ( /^Foot/.test( c.name ) ) {

			const link = athlete.links[ c.name ];
			const ee = new Goal();
			ee.name = link.name;
			ee.makeClosure( c );

			c.getWorldPosition( ee.position );
			c.getWorldQuaternion( ee.quaternion );
			ee.setMatrixNeedsUpdate();

			goalMap.set( ee, c );

		}

	} );

	cleanGeometry( athlete );

	return { ik, urdf: athlete, goalMap, helperScale: 0.2 };

}
