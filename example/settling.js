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

Mesh.prototype.raycast = acceleratedRaycast;
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

const params = {
	solve: true,
	displayMesh: true,
	displayIk: false,
	enableControls: true,
	terrainHeight: 0.35,
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
let terrain, directionalLight;
let ikNeedsUpdate = true;
const mouse = new Vector2();
const tempVec = new Vector3();
const raycaster = new Raycaster();
const posArr = new Float64Array( 3 );

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

	camera = new PerspectiveCamera( 50, window.innerWidth / window.innerHeight );
	camera.position.set( 8, 8, 8 );

	scene = new Scene();
	scene.background = new Color( 0x1e161d );

	// init light / shadow camera
	directionalLight = new DirectionalLight();
	directionalLight.position.set( 1, 3, 2 );
	directionalLight.intensity = 0.75;
	directionalLight.castShadow = true;
	directionalLight.shadow.normalBias = 1e-4;
	directionalLight.shadow.mapSize.setScalar( 1024 );

	const shadowCam = directionalLight.shadow.camera;
	shadowCam.top = shadowCam.right = 2;
	shadowCam.left = shadowCam.bottom = - 2;
	shadowCam.updateProjectionMatrix();
	scene.add( directionalLight, directionalLight.target );

	const ambientLight = new AmbientLight( 0x1f1a1e, 1 );
	scene.add( ambientLight );

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.setSpace( 'local' );
	scene.add( transformControls );

	transformControls.addEventListener( 'mouseDown', () => controls.enabled = false );
	transformControls.addEventListener( 'mouseUp', () => controls.enabled = true );

	// urdf target
	targetObject = new Group();
	targetObject.position.set( 0, 0, 0 );
	targetObject.rotation.set( Math.PI / 2, 0, 0 );
	scene.add( targetObject );
	transformControls.attach( targetObject );
	transformControls.addEventListener( 'objectChange', () => {

		ikNeedsUpdate = true;

	} );

	// generate terrain
	const dimension = 400;
	terrain = new Mesh( new PlaneBufferGeometry( 25, 25, dimension, dimension ), new MeshStandardMaterial() );

	const posAttr = terrain.geometry.attributes.position;
	for ( let x = 0; x <= dimension + 1; x ++ ) {

		for ( let y = 0; y <= dimension + 1; y ++ ) {

			const i = dimension * x + y;
			const xv = posAttr.getX( i ) * 1.5;
			const yv = posAttr.getY( i ) * 1.5;

			posAttr.setZ( i, Math.min( Math.abs( Math.sin( yv ) ), Math.abs( Math.sin( xv ) ) ) );

		}

	}

	terrain.rotation.set( - Math.PI / 2, 0, 0 );
	terrain.geometry.computeVertexNormals();
	terrain.receiveShadow = true;
	terrain.geometry.computeBoundsTree();
	scene.add( terrain );

	// init gui
	gui = new GUI();
	gui.add( params, 'enableControls' );
	gui.add( params, 'solve' );
	gui.add( params, 'displayMesh' );
	gui.add( params, 'displayIk' );
	gui.add( params, 'settleIterations' ).min( 1 ).max( 20 ).step( 1 ).onChange( () => ikNeedsUpdate = true );
	gui.add( params, 'terrainHeight', 0.05, 0.7 ).onChange( () => ikNeedsUpdate = true );

	// load model
	const loader = new URDFLoader();
	loader.fetchOptions = {
		mode: 'cors',
	};
	loader.loadMeshCb = ( path, manager, done ) => {

		if ( /\.glb$/.test( path ) || /\.gltf$/.test( path ) ) {

			new GLTFLoader( manager ).load( path, res => {

				res.scene.traverse( c => {

					c.castShadow = true;
					c.receiveShadow = true;
					if ( c.geometry && ! c.geometry.attributes.normals ) {

						c.geometry.computeVertexNormals();

					}

				} );
				done( res.scene );

			} );

		} else if ( /\.stl$/.test( path ) ) {

			new STLLoader( manager ).load( path, res => {

				const mesh = new Mesh( res );
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				done( mesh );

			} );

		}

	};

	loader
		.loadAsync( '../urdf/rover/m2020.urdf' )
		.then( result => {

			result.children[ 0 ].jointType = 'fixed';

			urdfRoot = result;
			ikRoot = urdfRobotToIKRoot( urdfRoot, true );

			const differential = ikRoot.find( c => c.name === 'CENTER_DIFFERENTIAL' ).child;
			differential.removeChild( differential.children[ 0 ] );

			// left connector
			const leftDifferential = ikRoot.find( c => c.name === 'LEFT_DIFFERENTIAL' ).child;
			const leftJoint = new Joint();
			differential.addChild( leftJoint );

			const leftArm = new Link();
			leftArm.setPosition( 0, - 0.7, 0 );
			leftJoint.addChild( leftArm );

			const leftZ = new Joint();
			leftZ.setDoF( DOF.EZ );
			leftArm.addChild( leftZ );

			const leftZLink = new Link();
			leftZLink.setPosition( 0, 0, 0 );
			leftZ.addChild( leftZLink );

			const leftY = new Joint();
			leftY.setDoF( DOF.EY );
			leftZLink.addChild( leftY );

			const leftConnector = new Link();
			leftDifferential.getWorldPosition( leftConnector.position );
			leftConnector.setMatrixNeedsUpdate();
			leftY.attachChild( leftConnector );
			leftConnector.position[ 1 ] = 0;
			leftConnector.position[ 2 ] = 0;
			leftConnector.setMatrixNeedsUpdate();

			const leftDiffConnectorJoint = new Joint();
			leftDifferential.addChild( leftDiffConnectorJoint );

			const leftDifferentialConnector = new Link();
			leftConnector.getWorldPosition( leftDifferentialConnector.position );
			leftConnector.getWorldQuaternion( leftDifferentialConnector.quaternion );
			leftDifferentialConnector.setMatrixNeedsUpdate();
			leftDiffConnectorJoint.attachChild( leftDifferentialConnector );

			const leftDiffGoal = new Goal();
			leftDiffGoal.setFreeDoF( DOF.EX, DOF.EY, DOF.EZ );
			leftDifferentialConnector.addChild( leftDiffGoal );
			leftDiffGoal.makeClosure( leftConnector );

			// right connector
			const rightDifferential = ikRoot.find( c => c.name === 'RIGHT_DIFFERENTIAL' ).child;
			const rightJoint = new Joint();
			differential.addChild( rightJoint );

			const rightArm = new Link();
			rightArm.setPosition( 0, 0.7, 0 );
			rightJoint.addChild( rightArm );

			const rightZ = new Joint();
			rightZ.setDoF( DOF.EZ );
			rightArm.addChild( rightZ );

			const rightZLink = new Link();
			rightZLink.setPosition( 0, 0, 0 );
			rightZ.addChild( rightZLink );

			const rightY = new Joint();
			rightY.setDoF( DOF.EY );
			rightZLink.addChild( rightY );

			const rightConnector = new Link();
			rightDifferential.getWorldPosition( rightConnector.position );
			rightConnector.setMatrixNeedsUpdate();
			rightY.attachChild( rightConnector );
			rightConnector.position[ 1 ] = 0;
			rightConnector.position[ 2 ] = 0;
			rightConnector.setMatrixNeedsUpdate();

			const rightDiffConnectorJoint = new Joint();
			rightDifferential.addChild( rightDiffConnectorJoint );

			const rightDifferentialConnector = new Link();
			rightConnector.getWorldPosition( rightDifferentialConnector.position );
			rightConnector.getWorldQuaternion( rightDifferentialConnector.quaternion );
			rightDifferentialConnector.setMatrixNeedsUpdate();
			rightDiffConnectorJoint.attachChild( rightDifferentialConnector );

			const rightDiffGoal = new Goal();
			rightDiffGoal.setFreeDoF( DOF.EX, DOF.EY, DOF.EZ );
			rightDifferentialConnector.addChild( rightDiffGoal );
			rightDiffGoal.makeClosure( rightConnector );

			// generate ik visualization
			ikHelper = new IKRootsHelper( [ ikRoot ] );
			ikHelper.setResolution( window.innerWidth, window.innerHeight );
			ikHelper.color.set( 0xe91e63 ).convertSRGBToLinear();
			ikHelper.setColor( ikHelper.color );

			drawThroughIkHelper = new IKRootsHelper( [ ikRoot ] );
			drawThroughIkHelper.setResolution( window.innerWidth, window.innerHeight );
			drawThroughIkHelper.color.set( 0xe91e63 ).convertSRGBToLinear();
			drawThroughIkHelper.setColor( drawThroughIkHelper.color );
			drawThroughIkHelper.setDrawThrough( true );

			urdfRoot.rotation.set( Math.PI / 2, 0, 0 );
			setIKFromUrdf( ikRoot, urdfRoot );

			// initialize wheel goals
			driveGoals = [
				'LR_DRIVE',
				'LM_DRIVE',
				'LF_DRIVE',
				'RR_DRIVE',
				'RM_DRIVE',
				'RF_DRIVE',
			].map( name => {

				const goal = new Goal();
				goal.setGoalDoF( DOF.X, DOF.Y, DOF.Z );
				ikRoot.traverse( c => {

					if ( c.name === name ) {

						const link = c.child;
						link.getWorldPosition( goal.position );
						goal.setMatrixWorldNeedsUpdate();
						goal.makeClosure( link );

					}

				} );
				return goal;

			} );

			// set the arm angles
			ikRoot.traverse( c => {

				switch ( c.name ) {

					case 'JOINT1_ENC':
						c.setTargetValues( 90 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

					case 'JOINT2_ENC':
						c.setTargetValues( - 18 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

					case 'JOINT3_ENC':
						c.setTargetValues( - 160 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

					case 'JOINT4_ENC':
						c.setTargetValues( 178 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

					case 'JOINT5_ENC':
						c.setTargetValues( 90 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

					case 'RSM_AZ_ENC':
						c.setTargetValues( 180 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

					case 'RSM_EL_ENC':
						c.setTargetValues( 90 * MathUtils.DEG2RAD );
						c.targetSet = true;
						break;

				}

			} );

			solver = new Solver( [ ikRoot, ...driveGoals ] );

			scene.add( urdfRoot, ikHelper, drawThroughIkHelper );

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
				controls.target.set( 0, 0, 0 );
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

		driveGoals.forEach( ( goal, i ) => {

			const link = goal.child;
			link.getWorldPosition( posArr );

			raycaster.ray.origin.set( posArr[ 0 ], 3, posArr[ 2 ] );
			raycaster.ray.direction.set( 0, - 1, 0 );
			raycaster.firstHitOnly = true;

			let height = 0;
			const res = raycaster.intersectObject( terrain, true );
			if ( res.length ) {

				height = res[ 0 ].point.y + 0.25;

			}

			goal.setPosition( posArr[ 0 ], height, posArr[ 2 ] );

		} );

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

	terrain.scale.z = params.terrainHeight;

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

