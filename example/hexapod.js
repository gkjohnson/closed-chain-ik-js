import {
	WebGLRenderer,
	PerspectiveCamera,
	Color,
	Scene,
	DirectionalLight,
	AmbientLight,
	Group,
	Vector3,
	Mesh,
	PCFSoftShadowMap,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {
	Solver,
	Link,
	Joint,
	SOLVE_STATUS_NAMES,
	IKRootsHelper,
	URDFUtils,
	Goal,
	DOF,
	SOLVE_STATUS,
} from '../src/index.js';
import URDFLoader from 'urdf-loader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

const params = {
	animate: 'gyrate',
	baseTilt: 0,
	solve: true,
	displayMesh: true,
	displayIk: false,
	enableControls: true,
	settleIterations: 6,
	displayConvergedOnly: true,
};

const solverOptions = {
	maxIterations: 10,
	divergeThreshold: 0.05,
	stallThreshold: 1e-5,
	translationErrorClamp: 0.01,
	rotationErrorClamp: 0.01,

	translationConvergeThreshold: 1e-5,
	rotationConvergeThreshold: 1e-5,
};

let gui, stats;
let outputContainer, renderer, scene, camera;
let controls, transformControls, targetObject;
let directionalLight;
let ikNeedsUpdate = true;
const tempVec = new Vector3();

let urdfRoot, ikRoot, ikHelper, drawThroughIkHelper, solver, platformLink, platformGoal;
init();
render();

function init() {

	stats = new Stats();
	document.body.appendChild( stats.dom );

	outputContainer = document.getElementById( 'output' );

	// init renderer
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	document.body.appendChild( renderer.domElement );

	camera = new PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 100 );
	camera.position.set( 0.3, 0.3, 0.3 );

	scene = new Scene();
	scene.background = new Color( 0x1e161d );

	// init light / shadow camera
	directionalLight = new DirectionalLight();
	directionalLight.position.set( 1, 3, 2 );
	directionalLight.intensity = 3 * 0.75;
	directionalLight.castShadow = true;
	directionalLight.shadow.mapSize.setScalar( 2048 );

	const shadowCam = directionalLight.shadow.camera;
	shadowCam.top = shadowCam.right = 0.25;
	shadowCam.left = shadowCam.bottom = - 0.25;
	shadowCam.near = 0;
	shadowCam.far = 10;
	shadowCam.updateProjectionMatrix();

	// add a directional light to illuminate the other side
	const otherDirectionalLight = new DirectionalLight();
	otherDirectionalLight.intensity = 3 * 0.25;
	otherDirectionalLight.position.set( - 1, - 3, - 2 );

	const ambientLight = new AmbientLight( 0x1f1a1e, 3 );
	scene.add( directionalLight, directionalLight.target, otherDirectionalLight, ambientLight );

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.y = 0.05;
	controls.update();

	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.setSpace( 'local' );
	scene.add( transformControls.getHelper() );

	transformControls.addEventListener( 'mouseDown', () => {

		controls.enabled = false;
		params.animate = 'none';

 	} );

	transformControls.addEventListener( 'mouseUp', () => {

		controls.enabled = true;
		ikNeedsUpdate = true;
		URDFUtils.setIKFromUrdf( ikRoot, urdfRoot );

		ikRoot.updateMatrixWorld( true );

	} );

	// hexapod platform target
	targetObject = new Group();
	scene.add( targetObject );

	transformControls.attach( targetObject );
	transformControls.addEventListener( 'objectChange', () => {

		ikNeedsUpdate = true;

	} );

	// init gui
	gui = new GUI();
	gui.add( params, 'enableControls' );
	gui.add( params, 'animate', [ 'none', 'gyrate', 'rotate' ] ).listen();
	gui.add( params, 'baseTilt', - 0.3, 0.3, 1e-4 ).onChange( () => ikNeedsUpdate = true );
	gui.add( params, 'solve' );
	gui.add( params, 'displayMesh' );
	gui.add( params, 'displayIk' );
	gui.add( params, 'displayConvergedOnly' );
	gui.add( params, 'settleIterations', 1, 20, 1 ).onChange( () => ikNeedsUpdate = true );

	// load model
	const loader = new URDFLoader();
	loader.fetchOptions = {
		mode: 'cors',
	};

	loader.packages = {
		'pi_hexapod_description': 'https://raw.githubusercontent.com/PI-PhysikInstrumente/PI_ROS_Driver/master/pi_hexapod_driver/pi_hexapod_description/',
	};

	loader.loadMeshCb = ( path, manager, done ) => {

		if ( /\.stl$/.test( path ) ) {

			new STLLoader( manager ).load( path, res => {

				const mesh = new Mesh( res );
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				done( mesh );

			} );

		} else if ( /\.dae$/.test( path ) ) {

			new ColladaLoader( manager ).load( path, res => {

				const model = res.scene;
				const lights = [];
				model.traverse( c => {

					c.castShadow = true;
					c.receiveShadow = true;
					if ( c.isLight ) {

						lights.push( c );

					}

				} );

				lights.forEach( l => {

					l.parent.remove( l );

				} );

				done( model );

			} );

		}

	};

	loader
		.loadAsync( 'https://raw.githubusercontent.com/gkjohnson/PI_ROS_Driver/master/pi_hexapod_driver/pi_hexapod_description/urdf/pi_hexapod.urdf' )
		.then( result => {

			urdfRoot = result;

			urdfRoot.traverse( c => {

				if ( c.jointType === 'floating' ) {

					c.jointType = 'fixed';

				}

			} );

			const joints = urdfRoot.joints;
			for ( const key in joints ) {

				// adjust the limits of the joints
				const joint = joints[ key ];
				if ( joint.name.includes( 'ang' ) ) {

					joint.limit.lower = - Infinity;
					joint.limit.upper = Infinity;

				} else if ( joint.name.includes( 'cart' ) ) {

					joint.limit.lower *= 5;
					joint.limit.upper *= 5;

				} else if ( joint.jointType === 'revolute' ) {

					joint.jointType = 'continuous';

				}

			}

			// generate the ik root and set the root to a fixed position
			ikRoot = URDFUtils.urdfRobotToIKRoot( urdfRoot );
			ikRoot.setDoF();

			// update the root from the URDF so goals can be placed in world space
			urdfRoot.rotation.set( - Math.PI / 2, 0, 0 );
			ikRoot.setEuler( - Math.PI / 2, 0, 0 );

			for ( let i = 0; i < 6; i ++ ) {

				const key = `axis${ i }_platform_anchor_joint_x`;
				const joint = urdfRoot.joints[ key ];
				joint.setJointValue( Math.PI );

			}

			URDFUtils.setIKFromUrdf( ikRoot, urdfRoot );

			// set the goal for the hexapod platform
			platformLink = ikRoot.find( c => c.name === 'platform_link' );
			platformGoal = new Goal();
			platformGoal.setEuler( - Math.PI / 2, 0, 0 );
			platformGoal.setPosition( 0, 0.095, 0 );
			platformGoal.makeClosure( platformLink );

			// set the target object position
			targetObject.quaternion.set( ...platformGoal.quaternion );
			targetObject.position.set( ...platformGoal.position );

			// set up the hexapod connections
			for ( let i = 0; i < 6; i ++ ) {

				// set up the base link with a prismatic joint and goal
				const baseLinkName = `axis${ i }_base_anchor_link_3`;
				const baseLink = ikRoot.find( c => c.name === baseLinkName );

				const prismJoint = new Joint();
				prismJoint.setDoF( DOF.Z );
				prismJoint.setMinLimits( 0.035 );
				prismJoint.setMaxLimits( 0.08 );
				baseLink.addChild( prismJoint );

				const prismLink = new Link();
				prismJoint.addChild( prismLink );

				const goal = new Joint();
				goal.setPosition( 0, 0, 0.05 );
				goal.setEuler( Math.PI, 0, 0 );
				prismLink.addChild( goal );

				// connect the goal to the platform link root
				const platformLinkName = `axis${ i }_platform_anchor_link_3`;
				const platformLink = ikRoot.find( c => c.name === platformLinkName );

				// set up the goal
				goal.makeClosure( platformLink );

			}

			// generate ik visualization
			ikHelper = new IKRootsHelper( [ ikRoot, platformGoal ] );
			ikHelper.setColor( 0xe91e63 );
			ikHelper.setJointScale( 0.05 );

			drawThroughIkHelper = new IKRootsHelper( [ ikRoot, platformGoal ] );
			drawThroughIkHelper.setColor( 0xe91e63 );
			drawThroughIkHelper.setDrawThrough( true );
			drawThroughIkHelper.setJointScale( 0.05 );

			solver = new Solver( [ ikRoot, platformGoal ] );

			scene.add( urdfRoot, ikHelper, drawThroughIkHelper );
			scene.add( urdfRoot );

		} );

	window.addEventListener( 'resize', () => {

		const w = window.innerWidth;
		const h = window.innerHeight;
		const aspect = w / h;

		renderer.setSize( w, h );

		camera.aspect = aspect;
		camera.updateProjectionMatrix();

	} );

	window.addEventListener( 'keydown', e => {

		switch ( e.key ) {

			case 'w':
				transformControls.setMode( 'translate' );
				break;
			case 'e':
				transformControls.setMode( 'rotate' );
				break;
			case 'q':
				transformControls.setSpace( transformControls.space === 'local' ? 'world' : 'local' );
				break;
			case 'f':
				controls.target.set( 0, 0.05, 0 );
				controls.update();
				break;

		}

	} );

}

function updateIk() {

	// update the hexapod platform from the draggable target
	platformGoal.setPosition(
		targetObject.position.x,
		targetObject.position.y,
		targetObject.position.z,
	);

	platformGoal.setQuaternion(
		targetObject.quaternion.x,
		targetObject.quaternion.y,
		targetObject.quaternion.z,
		targetObject.quaternion.w,
	);

	let solveOutput = '';
	let totalTime = 0;

	URDFUtils.setIKFromUrdf( ikRoot, urdfRoot );

	let isConverged = false;
	for ( let i = 0; i < params.settleIterations; i ++ ) {

		// update drive goals from the new location
		ikRoot.updateMatrixWorld( true );

		// update options
		Object.assign( solver, solverOptions );

		// update store results
		const startTime = window.performance.now();
		const results = solver.solve();
		const delta = window.performance.now() - startTime;
		totalTime += delta;

		solveOutput += delta.toFixed( 2 ) + 'ms ' + SOLVE_STATUS_NAMES[ results[ 0 ] ] + '\n';

		isConverged = results.filter( r => r === SOLVE_STATUS.CONVERGED ).length === results.length;
		const isAllDiverged = results.filter( r => r === SOLVE_STATUS.DIVERGED ).length === results.length;
		const isAllStalled = results.filter( r => r === SOLVE_STATUS.STALLED ).length === results.length;
		if ( isConverged || isAllDiverged || isAllStalled ) {

			break;

		}

	}

	// update output
	solveOutput = solveOutput + '\n' + 'Total: ' + totalTime.toFixed( 2 ) + 'ms';

	outputContainer.textContent = solveOutput;

	if ( ! params.displayConvergedOnly || isConverged ) {

		URDFUtils.setUrdfFromIK( urdfRoot, ikRoot );

	}

}

function render() {

	requestAnimationFrame( render );

	// update the transform target to jump to the platform if it's not being dragged
	if ( ikRoot && ! transformControls.dragging ) {

		targetObject.matrix.set( ...platformLink.matrixWorld ).transpose();
		targetObject.matrix.decompose(
			targetObject.position,
			targetObject.quaternion,
			targetObject.scale,
		);

		const pos = targetObject.position;
		const quat = targetObject.quaternion;
		platformGoal.setPosition( pos.x, pos.y, pos.z );
		platformGoal.setQuaternion( quat.x, quat.y, quat.z, quat.w );

	}

	if ( urdfRoot ) {

		// update the base tilt
		ikRoot.setEuler( - Math.PI / 2, 0, params.baseTilt );

		// animate the drag target
		if ( params.animate === 'gyrate' ) {

			const t = window.performance.now() * 0.004;
			targetObject.position.z = Math.cos( t ) * 0.02;
			targetObject.position.x = Math.sin( t ) * 0.02;
			targetObject.position.y = 0.1025;

			targetObject.rotation.set( - Math.PI / 2, 0, 0 );

			ikNeedsUpdate = true;

		} else if ( params.animate === 'rotate' ) {

			const t = window.performance.now() * 0.004;
			targetObject.position.set( 0, 0.105 + Math.sin( t ) * 0.0075, 0 );
			targetObject.rotation.set( - Math.PI / 2, 0, Math.cos( t * 1.0 ) * 0.75 );

			ikNeedsUpdate = true;

		}

		// run the solver
		if ( ikNeedsUpdate && params.solve ) {

			updateIk();
			ikNeedsUpdate = false;

		}

		// update the visibility
		urdfRoot.visible = params.displayMesh;
		ikHelper.visible = params.displayIk;
		drawThroughIkHelper.visible = params.displayIk;

		// update the light
		tempVec.subVectors( directionalLight.position, directionalLight.target.position );
		directionalLight.target.position.copy( urdfRoot.position );
		directionalLight.position.copy( urdfRoot.position ).add( tempVec );

	}

	// update the controls visibility
	transformControls.getHelper().visible = params.enableControls;
	transformControls.enabled = params.enableControls;

	renderer.render( scene, camera );
	stats.update();

}

