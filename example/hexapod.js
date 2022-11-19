import {
	WebGLRenderer,
	PerspectiveCamera,
	Color,
	Scene,
	DirectionalLight,
	AmbientLight,
	sRGBEncoding,
	Group,
	Raycaster,
	Vector2,
	Vector3,
	Mesh,
	PlaneBufferGeometry,
	MeshStandardMaterial,
	PCFSoftShadowMap,
	BufferGeometry,
	MathUtils,
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
	setUrdfFromIK,
	urdfRobotToIKRoot,
	setIKFromUrdf,
	Goal,
	DOF,
	SOLVE_STATUS,
} from '../src/index.js';
import URDFLoader from 'urdf-loader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

Mesh.prototype.raycast = acceleratedRaycast;
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

const params = {
	solve: true,
	displayMesh: true,
	displayIk: false,
	enableControls: true,
	settleIterations: 10,
};

const solverOptions = {
	maxIterations: 10,
	divergeThreshold: 0.05,
	stallThreshold: 1e-4,
	translationErrorClamp: 1,
	rotationErrorClamp: 0.25,
};

let gui, stats;
let outputContainer, renderer, scene, camera;
let driveGoals;
let controls, transformControls, targetObject;
let directionalLight;
let ikNeedsUpdate = true;
const mouse = new Vector2();
const tempVec = new Vector3();

let urdfRoot, ikRoot, ikHelper, drawThroughIkHelper, solver;
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
	renderer.outputEncoding = sRGBEncoding;
	document.body.appendChild( renderer.domElement );

	camera = new PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 100 );
	camera.position.set( 0.25, 0.25, 0.25 );

	scene = new Scene();
	scene.background = new Color( 0x1e161d );

	// init light / shadow camera
	directionalLight = new DirectionalLight();
	directionalLight.position.set( 1, 3, 2 );
	directionalLight.intensity = 0.75;
	directionalLight.castShadow = true;
	directionalLight.shadow.normalBias = 1e-3;
	directionalLight.shadow.mapSize.setScalar( 1024 );

	const shadowCam = directionalLight.shadow.camera;
	shadowCam.top = shadowCam.right = 0.5;
	shadowCam.left = shadowCam.bottom = - 0.5;
	shadowCam.updateProjectionMatrix();
	scene.add( directionalLight, directionalLight.target );

	const ambientLight = new AmbientLight( 0x1f1a1e, 1 );
	scene.add( ambientLight );

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.y = 0.075;
	controls.update();

	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.setSpace( 'local' );
	scene.add( transformControls );

	transformControls.addEventListener( 'mouseDown', () => controls.enabled = false );
	transformControls.addEventListener( 'mouseUp', () => controls.enabled = true );

	// urdf target
	targetObject = new Group();
	targetObject.position.set( 0, 0, 0 );
	targetObject.rotation.set( - Math.PI / 2, 0, 0 );
	scene.add( targetObject );
	transformControls.attach( targetObject );
	transformControls.addEventListener( 'objectChange', () => {

		ikNeedsUpdate = true;

	} );

	// init gui
	gui = new GUI();
	gui.add( params, 'enableControls' );
	gui.add( params, 'solve' );
	gui.add( params, 'displayMesh' );
	gui.add( params, 'displayIk' );
	gui.add( params, 'settleIterations' ).min( 1 ).max( 20 ).step( 1 ).onChange( () => ikNeedsUpdate = true );

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
		.loadAsync( '../example/PI_HEXAPOD.urdf' )
		.then( result => {

			result.traverse( c => {

				if ( c.jointType === 'floating' ) {

					c.jointType = 'fixed';

				}

			} );

			urdfRoot = result;
			ikRoot = urdfRobotToIKRoot( urdfRoot );
			ikRoot.setDoF();

			console.log( ikRoot );

			// console.log( urdfRoot.links );
			window.urdf = urdfRoot;
			for ( let i = 0; i < 1; i ++ ) {

				const baseLinkName = `axis${ i }_base_anchor_link_3`;
				const baseLink = ikRoot.find( c => c.name === baseLinkName );

				const platformLinkName = `axis${ i }_platform_anchor_link_3`;
				const platformLink = ikRoot.find( c => c.name === platformLinkName );

				// const goalJoint = new Joint();
				// baseLink.addChild(goalJoint);

				// const goal = new Goal();
				// goal.setFreeDoF( DOF.Z );
				// baseLink.addChild( goal );
				// goal.makeClosure( platformLink );



			}

			// const differential = ikRoot.find( c => c.name === 'CENTER_DIFFERENTIAL' ).child;
			// differential.removeChild( differential.children[ 0 ] );

			// // left connector
			// const leftDifferential = ikRoot.find( c => c.name === 'LEFT_DIFFERENTIAL' ).child;
			// const leftJoint = new Joint();
			// differential.addChild( leftJoint );

			// const leftArm = new Link();
			// leftArm.setPosition( 0, - 0.7, 0 );
			// leftJoint.addChild( leftArm );

			// const leftZ = new Joint();
			// leftZ.setDoF( DOF.EZ );
			// leftArm.addChild( leftZ );

			// const leftZLink = new Link();
			// leftZLink.setPosition( 0, 0, 0 );
			// leftZ.addChild( leftZLink );

			// const leftY = new Joint();
			// leftY.setDoF( DOF.EY );
			// leftZLink.addChild( leftY );

			// const leftConnector = new Link();
			// leftDifferential.getWorldPosition( leftConnector.position );
			// leftConnector.setMatrixNeedsUpdate();
			// leftY.attachChild( leftConnector );
			// leftConnector.position[ 1 ] = 0;
			// leftConnector.position[ 2 ] = 0;
			// leftConnector.setMatrixNeedsUpdate();

			// const leftDiffConnectorJoint = new Joint();
			// leftDifferential.addChild( leftDiffConnectorJoint );

			// const leftDifferentialConnector = new Link();
			// leftConnector.getWorldPosition( leftDifferentialConnector.position );
			// leftConnector.getWorldQuaternion( leftDifferentialConnector.quaternion );
			// leftDifferentialConnector.setMatrixNeedsUpdate();
			// leftDiffConnectorJoint.attachChild( leftDifferentialConnector );

			// const leftDiffGoal = new Goal();
			// leftDiffGoal.setFreeDoF( DOF.EX, DOF.EY, DOF.EZ );
			// leftDifferentialConnector.addChild( leftDiffGoal );
			// leftDiffGoal.makeClosure( leftConnector );

			// // right connector
			// const rightDifferential = ikRoot.find( c => c.name === 'RIGHT_DIFFERENTIAL' ).child;
			// const rightJoint = new Joint();
			// differential.addChild( rightJoint );

			// const rightArm = new Link();
			// rightArm.setPosition( 0, 0.7, 0 );
			// rightJoint.addChild( rightArm );

			// const rightZ = new Joint();
			// rightZ.setDoF( DOF.EZ );
			// rightArm.addChild( rightZ );

			// const rightZLink = new Link();
			// rightZLink.setPosition( 0, 0, 0 );
			// rightZ.addChild( rightZLink );

			// const rightY = new Joint();
			// rightY.setDoF( DOF.EY );
			// rightZLink.addChild( rightY );

			// const rightConnector = new Link();
			// rightDifferential.getWorldPosition( rightConnector.position );
			// rightConnector.setMatrixNeedsUpdate();
			// rightY.attachChild( rightConnector );
			// rightConnector.position[ 1 ] = 0;
			// rightConnector.position[ 2 ] = 0;
			// rightConnector.setMatrixNeedsUpdate();

			// const rightDiffConnectorJoint = new Joint();
			// rightDifferential.addChild( rightDiffConnectorJoint );

			// const rightDifferentialConnector = new Link();
			// rightConnector.getWorldPosition( rightDifferentialConnector.position );
			// rightConnector.getWorldQuaternion( rightDifferentialConnector.quaternion );
			// rightDifferentialConnector.setMatrixNeedsUpdate();
			// rightDiffConnectorJoint.attachChild( rightDifferentialConnector );

			// const rightDiffGoal = new Goal();
			// rightDiffGoal.setFreeDoF( DOF.EX, DOF.EY, DOF.EZ );
			// rightDifferentialConnector.addChild( rightDiffGoal );
			// rightDiffGoal.makeClosure( rightConnector );

			// generate ik visualization
			ikHelper = new IKRootsHelper( [ ikRoot ] );
			ikHelper.setResolution( window.innerWidth, window.innerHeight );
			ikHelper.color.set( 0xe91e63 ).convertSRGBToLinear();
			ikHelper.setColor( ikHelper.color );
			ikHelper.setJointScale( 0.05 );

			window.ikHelper = ikHelper;

			drawThroughIkHelper = new IKRootsHelper( [ ikRoot ] );
			drawThroughIkHelper.setResolution( window.innerWidth, window.innerHeight );
			drawThroughIkHelper.color.set( 0xe91e63 ).convertSRGBToLinear();
			drawThroughIkHelper.setColor( drawThroughIkHelper.color );
			drawThroughIkHelper.setDrawThrough( true );
			drawThroughIkHelper.setJointScale( 0.05 );

			urdfRoot.rotation.set( - Math.PI / 2, 0, 0 );
			setIKFromUrdf( ikRoot, urdfRoot );

			solver = new Solver( [ ikRoot ] );

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

		if ( ikHelper ) {

			ikHelper.setResolution( window.innerWidth, window.innerHeight );
			drawThroughIkHelper.setResolution( window.innerWidth, window.innerHeight );

		}

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
				controls.target.set( 0, 0.075, 0 );
				controls.update();
				break;

		}

	} );

	renderer.domElement.addEventListener( 'pointerdown', e => {

		mouse.x = e.clientX;
		mouse.y = e.clientY;

	} );

}

function updateIk() {

	// update the ik root from the draggable root
	ikRoot.setPosition(
		targetObject.position.x,
		ikRoot.position[ 1 ],
		targetObject.position.z,
	);

	ikRoot.setQuaternion(
		targetObject.quaternion.x,
		targetObject.quaternion.y,
		targetObject.quaternion.z,
		targetObject.quaternion.w,
	);

	ikRoot.traverse( c => {

		if ( c.isJoint ) {

			c.dofValues.fill( 0 );
			c.setMatrixDoFNeedsUpdate();

		}

	} );

	let solveOutput = '';
	let totalTime = 0;

	for ( let i = 0; i < params.settleIterations; i ++ ) {

		// udpate drive goals from the new location
		ikRoot.updateMatrixWorld( true );

		// driveGoals.forEach( ( goal, i ) => {

		// 	const link = goal.child;
		// 	link.getWorldPosition( posArr );

		// 	raycaster.ray.origin.set( posArr[ 0 ], 3, posArr[ 2 ] );
		// 	raycaster.ray.direction.set( 0, - 1, 0 );
		// 	raycaster.firstHitOnly = true;

		// 	let height = 0;
		// 	const res = raycaster.intersectObject( terrain, true );
		// 	if ( res.length ) {

		// 		height = res[ 0 ].point.y + 0.25;

		// 	}

		// 	goal.setPosition( posArr[ 0 ], height, posArr[ 2 ] );

		// } );

		// update options
		Object.assign( solver, solverOptions );

		// update store results
		const startTime = window.performance.now();
		const results = solver.solve();
		const delta = window.performance.now() - startTime;
		totalTime += delta;

		solveOutput += delta.toFixed( 2 ) + 'ms ' + SOLVE_STATUS_NAMES[ results[ 0 ] ] + '\n';

		const isConverged = results.filter( r => r === SOLVE_STATUS.CONVERGED ).length === results.length;
		const isAllDiverged = results.filter( r => r === SOLVE_STATUS.DIVERGED ).length === results.length;
		if ( isConverged || isAllDiverged ) {

			break;

		}

	}

	// update output
	solveOutput = solveOutput + '\n' + 'Total: ' + totalTime.toFixed( 2 ) + 'ms';

	outputContainer.textContent = solveOutput;

	setUrdfFromIK( urdfRoot, ikRoot );

}

function render() {

	requestAnimationFrame( render );

	if ( urdfRoot ) {

		if ( ikNeedsUpdate && params.solve ) {

			updateIk();
			ikNeedsUpdate = false;

		} else if ( ! params.solve ) {

			ikRoot.setPosition(
				targetObject.position.x,
				targetObject.position.y,
				targetObject.position.z,
			);
			ikRoot.setQuaternion(
				targetObject.quaternion.x,
				targetObject.quaternion.y,
				targetObject.quaternion.z,
				targetObject.quaternion.w,
			);
			setUrdfFromIK( urdfRoot, ikRoot );

		}

	}

	if ( urdfRoot ) {

		urdfRoot.visible = params.displayMesh;
		ikHelper.visible = params.displayIk;
		drawThroughIkHelper.visible = params.displayIk;

	}

	if ( ikRoot && ! transformControls.dragging ) {

		targetObject.position.set( ...ikRoot.position );
		targetObject.quaternion.set( ...ikRoot.quaternion );

	}

	if ( urdfRoot ) {

		tempVec.subVectors( directionalLight.position, directionalLight.target.position );
		directionalLight.target.position.copy( urdfRoot.position );
		directionalLight.position.copy( urdfRoot.position ).add( tempVec );

	}

	transformControls.visible = params.enableControls;
	transformControls.enabled = params.enableControls;

	renderer.render( scene, camera );
	stats.update();

}

