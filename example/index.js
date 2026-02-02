import {
	WebGLRenderer,
	PerspectiveCamera,
	Color,
	Scene,
	DirectionalLight,
	AmbientLight,
	Group,
	Raycaster,
	Vector2,
	Mesh,
	SphereGeometry,
	MeshBasicMaterial,
	PCFSoftShadowMap,
	Box3,
	Sphere,
	Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {
	Solver,
	WorkerSolver,
	Link,
	Joint,
	SOLVE_STATUS_NAMES,
	IKRootsHelper,
	URDFUtils,
	Goal,
} from '../src/index.js';
import {
	loadATHLETE,
	loadRobonaut,
	loadStaubli,
	loadDigit,
	loadCuriosity,
	loadSpot,
} from './loadModels.js';

const MODEL_LOADERS = {
	'ATHLETE': loadATHLETE,
	'Robonaut': loadRobonaut,
	'Curiosity': loadCuriosity,
	'Staubli': loadStaubli,
	'Digit': loadDigit,
	'Spot': loadSpot,
};

const params = {
	solve: true,
	displayMesh: true,
	displayIk: true,
	displayGoals: true,
	displayShadows: true,
	model: 'ATHLETE',
	webworker: true,
};

const solverOptions = {
	useSVD: false,
	maxIterations: 6,
	divergeThreshold: 0.05,
	stallThreshold: 1e-4,
	translationErrorClamp: 0.25,
	rotationErrorClamp: 0.25,
	translationConvergeThreshold: 1e-3,
	rotationConvergeThreshold: 1e-5,
	restPoseFactor: 0.025,
};

// Goal tracking
const goalToLinkMap = new Map();
const linkToGoalMap = new Map();
const goals = [];
const goalIcons = [];
let selectedGoalIndex = - 1;

// Scene objects
let gui, stats, outputContainer;
let renderer, scene, camera, directionalLight;
let controls, transformControls, targetObject;
let solver, ikHelper, drawThroughIkHelper, ikRoot, urdfRoot;

// Loading and timing
let loadId = 0;
let averageTime = 0;
let averageCount = 0;

// Reusable objects
const _mouse = new Vector2();
const _box = new Box3();
const _sphere = new Sphere();
const _vector = new Vector3();

// ----------------------------------------
// Initialization
// ----------------------------------------

init();
rebuildGUI();
loadModel( MODEL_LOADERS[ params.model ]() );

function init() {

	// stats
	stats = new Stats();
	document.body.appendChild( stats.dom );

	// output
	outputContainer = document.getElementById( 'output' );

	// renderer
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	renderer.setAnimationLoop( render );
	document.body.appendChild( renderer.domElement );

	// camera
	camera = new PerspectiveCamera( 50, window.innerWidth / window.innerHeight );
	camera.position.set( 8, 8, 8 );

	// scene
	scene = new Scene();
	scene.background = new Color( 0x131619 );

	// lights
	directionalLight = new DirectionalLight( 0xffffff, 3 );
	directionalLight.position.set( 1, 3, 2 );
	directionalLight.castShadow = true;
	directionalLight.shadow.mapSize.setScalar( 2048 );
	scene.add( directionalLight, directionalLight.target );

	const ambientLight = new AmbientLight( 0x263238, 3 );
	scene.add( ambientLight );

	// camera controls
	controls = new OrbitControls( camera, renderer.domElement );

	// transform controls
	targetObject = new Group();
	targetObject.position.set( 0, 1, 1 );
	scene.add( targetObject );

	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.setSpace( 'local' );
	transformControls.attach( targetObject );
	scene.add( transformControls.getHelper() );

	transformControls.addEventListener( 'mouseDown', () => controls.enabled = false );
	transformControls.addEventListener( 'mouseUp', () => controls.enabled = true );

	//

	// Window resize
	window.addEventListener( 'resize', () => {

		const w = window.innerWidth;
		const h = window.innerHeight;

		renderer.setSize( w, h );
		camera.aspect = w / h;
		camera.updateProjectionMatrix();

	} );

	// Keyboard shortcuts
	window.addEventListener( 'keydown', e => {

		// w: translate mode
		// e: rotation mode
		// q: world / local space toggle
		// f: frame camera
		// delete: remove selected goal
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
				camera.position.sub( controls.target );
				controls.target.set( 0, 0, 0 );
				controls.update();
				break;

		}

		if ( selectedGoalIndex !== - 1 && ( e.code === 'Delete' || e.code === 'Backspace' ) ) {

			deleteGoal( goals[ selectedGoalIndex ] );
			selectedGoalIndex = - 1;

		}

	} );

	// Transform controls release - snap goal back to relative position
	transformControls.addEventListener( 'mouseUp', () => {

		if ( selectedGoalIndex === - 1 ) {

			return;

		}

		const goal = goals[ selectedGoalIndex ];
		const ikLink = goalToLinkMap.get( goal );
		if ( ! ikLink ) {

			return;

		}

		ikLink.updateMatrixWorld();
		ikLink.attachChild( goal );
		goal.setPosition( ...goal.originalPosition );
		goal.setQuaternion( ...goal.originalQuaternion );
		ikLink.detachChild( goal );

		targetObject.position.set( ...goal.position );
		targetObject.quaternion.set( ...goal.quaternion );

	} );

	// Mouse tracking for click detection
	renderer.domElement.addEventListener( 'pointerdown', e => {

		_mouse.x = e.clientX;
		_mouse.y = e.clientY;

	} );

	// Click handling
	renderer.domElement.addEventListener( 'pointerup', e => {

		// Ignore drags
		if ( Math.abs( e.clientX - _mouse.x ) > 3 || Math.abs( e.clientY - _mouse.y ) > 3 || ! urdfRoot ) {

			return;

		}

		const { ikLink, result } = raycast( e );

		if ( ikLink === null ) {

			selectedGoalIndex = - 1;

		}

		if ( e.button === 2 ) {

			handleRightClick( ikLink, result );

		} else if ( e.button === 0 ) {

			handleLeftClick( ikLink, result );

		}

	} );

}

// event handlers
function handleRightClick( ikLink, result ) {

	// create new goal at the clicked location

	if ( ! ikLink ) {

		return;

	}

	// Remove existing goal on this link
	if ( linkToGoalMap.has( ikLink ) ) {

		deleteGoal( linkToGoalMap.get( ikLink ) );

	}

	// Create goal structure: rootGoalJoint -> goalLink -> goalJoint -> (closure to ikLink)
	const rootGoalJoint = new Joint();
	rootGoalJoint.name = 'GoalRootJoint-' + ikLink.name;
	rootGoalJoint.setPosition( result.point.x, result.point.y, result.point.z );

	const goalLink = new Link();
	rootGoalJoint.addChild( goalLink );

	const goalJoint = new Goal();
	goalJoint.name = 'GoalJoint-' + ikLink.name;
	ikLink.getWorldPosition( goalJoint.position );
	ikLink.getWorldQuaternion( goalJoint.quaternion );
	goalJoint.setMatrixNeedsUpdate();

	goalLink.attachChild( goalJoint );
	goalJoint.makeClosure( ikLink );

	// Save relative position for snapping
	ikLink.attachChild( rootGoalJoint );
	rootGoalJoint.originalPosition = rootGoalJoint.position.slice();
	rootGoalJoint.originalQuaternion = rootGoalJoint.quaternion.slice();
	ikLink.detachChild( rootGoalJoint );

	// Update solver and helpers
	solver.updateStructure();
	ikHelper.updateStructure();
	drawThroughIkHelper.updateStructure();

	// Update transform controls
	targetObject.position.set( ...rootGoalJoint.position );
	targetObject.quaternion.set( ...rootGoalJoint.quaternion );

	// Register goal
	goalToLinkMap.set( rootGoalJoint, ikLink );
	linkToGoalMap.set( ikLink, rootGoalJoint );
	goals.push( rootGoalJoint );
	selectedGoalIndex = goals.length - 1;

}

function handleLeftClick( ikLink, result ) {

	// select a goal

	if ( transformControls.dragging ) {

		return;

	}

	// Check if clicked on a goal icon
	selectedGoalIndex = goalIcons.indexOf( result ? result.object.parent : null );

	if ( selectedGoalIndex !== - 1 ) {

		const goal = goals[ selectedGoalIndex ];
		targetObject.position.set( ...goal.position );
		targetObject.quaternion.set( ...goal.quaternion );

	} else if ( ikLink && linkToGoalMap.has( ikLink ) ) {

		const goal = linkToGoalMap.get( ikLink );
		selectedGoalIndex = goals.indexOf( goal );
		targetObject.position.set( ...goal.position );
		targetObject.quaternion.set( ...goal.quaternion );

	}

}

// goal management
function deleteGoal( goal ) {

	const index = goals.indexOf( goal );

	goal.traverse( c => {

		if ( c.isClosure ) {

			c.removeChild( c.child );

		}

	} );

	goals.splice( index, 1 );

	const link = goalToLinkMap.get( goal );
	goalToLinkMap.delete( goal );
	linkToGoalMap.delete( link );

	solver.updateStructure();
	ikHelper.updateStructure();
	drawThroughIkHelper.updateStructure();

}

// raycast against the scene and return a target link and position
function raycast( e ) {

	const raycaster = new Raycaster();
	const mouseNDC = new Vector2();
	mouseNDC.x = ( e.clientX / window.innerWidth ) * 2 - 1;
	mouseNDC.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
	raycaster.setFromCamera( mouseNDC, camera );

	// Check goal icons first
	const intersectGoals = goalIcons.slice( 0, goals.length );
	let results = raycaster.intersectObjects( intersectGoals, true );
	if ( results.length !== 0 ) {

		return { ikLink: null, result: results[ 0 ] };

	}

	// Check URDF model
	results = raycaster.intersectObjects( [ urdfRoot ], true );
	if ( results.length === 0 ) {

		return { ikLink: null, result: null };

	}

	// Find the IK link corresponding to the hit URDF link
	const result = results[ 0 ];
	let nearestLink = null;
	let ikLink = null;

	result.object.traverseAncestors( p => {

		if ( nearestLink === null && p.isURDFLink ) {

			nearestLink = p;
			ikRoot.traverse( c => {

				if ( c.name === nearestLink.name ) {

					ikLink = c;

				}

			} );

		}

	} );

	return { ikLink, result };

}


// render
function render() {

	if ( ikRoot ) {

		updateGoalFromTransformControls();
		if ( params.solve ) {

			solve();

		}

		updateVisibility();
		updateShadowCamera();

	}

	updateGoalIcons();

	// update transform controls visibility
	transformControls.enabled = selectedGoalIndex !== - 1;
	transformControls.getHelper().visible = selectedGoalIndex !== - 1;

	renderer.render( scene, camera );
	stats.update();

}

// update the goal from the transform controls dummy
function updateGoalFromTransformControls() {

	const selectedGoal = goals[ selectedGoalIndex ];
	if ( selectedGoal ) {

		selectedGoal.setPosition(
			targetObject.position.x,
			targetObject.position.y,
			targetObject.position.z,
		);
		selectedGoal.setQuaternion(
			targetObject.quaternion.x,
			targetObject.quaternion.y,
			targetObject.quaternion.z,
			targetObject.quaternion.w,
		);

	}

}

// Run the solver
function solve() {

	const startTime = window.performance.now();
	let statuses;

	if ( solver instanceof WorkerSolver ) {

		solver.updateFrameState( ...goals );
		solver.updateSolverSettings( solverOptions );
		statuses = solver.status;

		if ( ! solver.running ) {

			solver.solve();

		}

	} else {

		Object.assign( solver, solverOptions );
		statuses = solver.solve();

	}

	const deltaTime = window.performance.now() - startTime;

	// Update timing display
	if ( averageCount < 50 ) averageCount ++;
	averageTime += ( deltaTime - averageTime ) / averageCount;

	outputContainer.innerText =
		`solve time \t: ${ deltaTime.toFixed( 3 ) }ms\n` +
		`avg solve time \t: ${ averageTime.toFixed( 3 ) }ms\n` +
		statuses.map( s => SOLVE_STATUS_NAMES[ s ] ).join( '\n' );

	URDFUtils.setUrdfFromIK( urdfRoot, ikRoot );

}

function updateVisibility() {

	urdfRoot.visible = params.displayMesh;

	// Toggle IK helpers for performance
	if ( ! params.displayIk && ikHelper.parent ) {

		scene.remove( ikHelper, drawThroughIkHelper );

	} else if ( params.displayIk && ! ikHelper.parent ) {

		scene.add( ikHelper, drawThroughIkHelper );

	}

}

function updateGoalIcons() {

	// Create icons as needed
	while ( goalIcons.length < goals.length ) {

		goalIcons.push( createGoalIcon() );

	}

	// Update icon positions
	goalIcons.forEach( g => g.visible = false );
	goals.forEach( ( g, i ) => {

		goalIcons[ i ].position.set( ...g.position );
		goalIcons[ i ].quaternion.set( ...g.quaternion );
		goalIcons[ i ].visible = params.displayGoals;

	} );

}

function createGoalIcon() {

	const color = new Color( 0xffca28 );
	const group = new Group();

	// add a solid and draw through mesh
	const solidMesh = new Mesh(
		new SphereGeometry( 0.05, 30, 30 ),
		new MeshBasicMaterial( { color } ),
	);

	const drawThroughMesh = new Mesh(
		new SphereGeometry( 0.05, 30, 30 ),
		new MeshBasicMaterial( {
			color,
			opacity: 0.4,
			transparent: true,
			depthWrite: false,
			depthTest: false,
		} ),
	);

	// Scale based on distance to camera for consistent screen size
	const ogUpdateMatrix = solidMesh.updateMatrix;
	function updateMatrix( ...args ) {

		this.scale.setScalar( this.position.distanceTo( camera.position ) * 0.15 );
		ogUpdateMatrix.call( this, ...args );

	}

	solidMesh.updateMatrix = updateMatrix;
	drawThroughMesh.updateMatrix = updateMatrix;

	group.add( solidMesh, drawThroughMesh );
	scene.add( group );

	return group;

}

function updateShadowCamera() {

	if ( ! urdfRoot ) {

		return;

	}

	// Get bounding sphere of the model
	_box.setFromObject( urdfRoot ).getBoundingSphere( _sphere );

	// Position light target at model center
	_vector.subVectors( directionalLight.position, directionalLight.target.position );
	directionalLight.target.position.copy( _sphere.center );

	// Size shadow camera to fit model
	const shadowCam = directionalLight.shadow.camera;
	shadowCam.left = shadowCam.bottom = - _sphere.radius;
	shadowCam.right = shadowCam.top = _sphere.radius;
	shadowCam.near = 0;
	shadowCam.far = _sphere.radius * 2;
	shadowCam.updateProjectionMatrix();

	// Position light
	_vector.normalize().multiplyScalar( _sphere.radius );
	directionalLight.position.addVectors( _sphere.center, _vector );

	directionalLight.castShadow = params.displayShadows;

}

// gui
function rebuildGUI() {

	if ( gui ) {

		gui.destroy();

	}

	if ( ! ikRoot ) {

		return;

	}

	gui = new GUI();
	gui.width = 350;

	// Model selection
	gui.add( params, 'model', Object.keys( MODEL_LOADERS ) ).onChange( value => {

		loadModel( MODEL_LOADERS[ value ]() );

	} );

	// Display options
	gui.add( params, 'displayMesh' ).name( 'display mesh' );
	gui.add( params, 'displayGoals' ).name( 'display goals' );
	gui.add( params, 'displayIk' ).name( 'display ik chains' );
	gui.add( params, 'displayShadows' ).name( 'shadows' );

	// Worker toggle
	gui.add( params, 'webworker' ).onChange( v => {

		if ( v ) {

			solver = new WorkerSolver( solver.roots );

		} else {

			solver.dispose();
			solver = new Solver( solver.roots );

		}

	} );

	// Reset button
	gui.add( {
		reset: () => loadModel( MODEL_LOADERS[ params.model ]() )
	}, 'reset' );

	// Solver options folder
	const solveFolder = gui.addFolder( 'solver' );
	solveFolder.add( params, 'solve' ).onChange( v => {

		if ( ! v && solver instanceof WorkerSolver ) {

			solver.stop();

		}

	} );

	solveFolder.add( solverOptions, 'useSVD' );
	solveFolder.add( solverOptions, 'maxIterations' ).min( 1 ).max( 15 ).step( 1 ).listen();
	solveFolder.add( solverOptions, 'divergeThreshold' ).min( 0 ).max( 0.5 ).step( 1e-2 ).listen();
	solveFolder.add( solverOptions, 'stallThreshold' ).min( 0 ).max( 0.01 ).step( 1e-4 ).listen();
	solveFolder.add( solverOptions, 'translationErrorClamp' ).min( 1e-2 ).max( 1 ).listen();
	solveFolder.add( solverOptions, 'rotationErrorClamp' ).min( 1e-2 ).max( 1 ).listen();
	solveFolder.add( solverOptions, 'translationConvergeThreshold' ).min( 1e-3 ).max( 1e-1 ).listen();
	solveFolder.add( solverOptions, 'rotationConvergeThreshold' ).min( 1e-5 ).max( 1e-2 ).listen();
	solveFolder.add( solverOptions, 'restPoseFactor' ).min( 0 ).max( 0.25 ).step( 1e-2 ).listen();
	solveFolder.open();

}

// model loading
function loadModel( promise ) {

	// Cleanup previous model
	if ( urdfRoot ) {

		urdfRoot.traverse( disposeObject );
		drawThroughIkHelper.traverse( disposeObject );
		ikHelper.traverse( disposeObject );
		scene.remove( urdfRoot, drawThroughIkHelper, ikHelper );

	}

	// Reset state
	ikRoot = null;
	urdfRoot = null;
	ikHelper = null;
	drawThroughIkHelper = null;
	goals.length = 0;
	goalToLinkMap.clear();
	linkToGoalMap.clear();
	selectedGoalIndex = - 1;

	// Track load ID to ignore stale loads
	loadId ++;
	const thisLoadId = loadId;

	promise.then( ( { goalMap, urdf, ik, helperScale = 1 } ) => {

		if ( loadId !== thisLoadId ) return;

		ik.updateMatrixWorld( true );

		// Create IK helpers
		ikHelper = new IKRootsHelper( ik );
		ikHelper.setJointScale( helperScale );
		ikHelper.color.set( 0xe91e63 );
		ikHelper.setColor( ikHelper.color );

		drawThroughIkHelper = new IKRootsHelper( ik );
		drawThroughIkHelper.setJointScale( helperScale );
		drawThroughIkHelper.color.set( 0xe91e63 );
		drawThroughIkHelper.setColor( drawThroughIkHelper.color );
		drawThroughIkHelper.setDrawThrough( true );

		// Enable shadows on model
		urdf.traverse( c => {

			c.castShadow = true;
			c.receiveShadow = true;

		} );

		scene.add( urdf, ikHelper, drawThroughIkHelper );

		// Register goals from the loaded model
		const loadedGoals = [];
		goalMap.forEach( ( link, goal ) => {

			loadedGoals.push( goal );
			goalToLinkMap.set( goal, link );
			linkToGoalMap.set( link, goal );

		} );

		// Create solver
		solver = params.webworker ? new WorkerSolver( ik ) : new Solver( ik );

		// Select first goal
		if ( loadedGoals.length ) {

			targetObject.position.set( ...loadedGoals[ 0 ].position );
			targetObject.quaternion.set( ...loadedGoals[ 0 ].quaternion );
			selectedGoalIndex = 0;

		} else {

			selectedGoalIndex = - 1;

		}

		// Initialize goal original positions
		loadedGoals.forEach( g => {

			g.originalPosition = [ 0, 0, 0 ];
			g.originalQuaternion = [ 0, 0, 0, 1 ];

		} );

		// Update references
		ikRoot = ik;
		urdfRoot = urdf;
		goals.push( ...loadedGoals );

		rebuildGUI();

	} );

}

// disposal
function disposeObject( c ) {

	if ( c.geometry ) {

		c.geometry.dispose();

	}

	if ( c.material ) {

		const materials = Array.isArray( c.material ) ? c.material : [ c.material ];
		materials.forEach( material => {

			material.dispose();
			for ( const key in material ) {

				if ( material[ key ] && material[ key ].isTexture ) {

					material[ key ].dispose();

				}

			}

		} );

	}

}
