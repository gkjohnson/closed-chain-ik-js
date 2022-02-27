import {
	WebGLRenderer,
	PerspectiveCamera,
	Color,
	Scene,
	DirectionalLight,
	AmbientLight,
	sRGBEncoding,
	Group,
} from 'three';
import {
	OrbitControls,
} from 'three/examples/jsm/controls/OrbitControls.js';
import {
	TransformControls
} from 'three/examples/jsm/controls/TransformControls.js';
import {
	GUI,
} from 'three/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {
	Solver,
	Link,
	Joint,
	IKRootsHelper,
	Goal,
	DOF,
	SOLVE_STATUS_NAMES,
} from '../src/index.js';

const params = {
	controls: 'translate',
	solvePosition: true,
	solveRotation: false,
};

// TODO: why is the solve stalling so frequently? Only when goal is set with rotation.
// Matching rotation goal doesn't seem to work.
const solverOptions = {
	maxIterations: 3,
	divergeThreshold: 0.005,
	stallThreshold: 1e-3,
	translationErrorClamp: 0.25,
	rotationErrorClamp: 0.25,
	translationConvergeThreshold: 1e-3,
	rotationConvergeThreshold: 1e-3,
	restPoseFactor: 0.001,
};

let gui, stats;
let outputContainer, renderer, scene, camera;
let solver, ikHelper, ikRoot, goal;
let controls, transformControls, targetObject;

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
	renderer.outputEncoding = sRGBEncoding;
	document.body.appendChild( renderer.domElement );

	camera = new PerspectiveCamera( 50, window.innerWidth / window.innerHeight );
	camera.position.set( 8, 8, 8 );

	scene = new Scene();
	scene.background = new Color( 0x131619 );

	const directionalLight = new DirectionalLight();
	directionalLight.position.set( 1, 3, 2 );
	scene.add( directionalLight );

	const ambientLight = new AmbientLight( 0x263238, 1 );
	scene.add( ambientLight );

	controls = new OrbitControls( camera, renderer.domElement );
	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.setSpace( 'local' );
	scene.add( transformControls );

	transformControls.addEventListener( 'mouseDown', () => controls.enabled = false );
	transformControls.addEventListener( 'mouseUp', () => controls.enabled = true );

	targetObject = new Group();
	targetObject.position.set( 0, 1, 1 );
	scene.add( targetObject );
	transformControls.attach( targetObject );

	ikRoot = null;
	let currRoot = null;
	for ( let i = 0; i < 6; i ++ ) {

		const link = new Link();
		const joint = new Joint();
		joint.setPosition( 0, 0.5, 0 );
		joint.setDoF( i % 2 ? DOF.EX : DOF.EZ );
		joint.setDoFValues( Math.PI / 4 );
		joint.setRestPoseValues( Math.PI / 4 );
		joint.restPoseSet = true;
		joint.setMinLimits( - 0.9 * Math.PI );
		joint.setMaxLimits( 0.9 * Math.PI );

		link.addChild( joint );

		if ( currRoot ) {

			currRoot.addChild( link );

		}

		if ( ikRoot === null ) {

			ikRoot = link;

		}

		currRoot = joint;

	}

	const finalLink = new Link();
	finalLink.setPosition( 0, 0.5, 0 );
	currRoot.addChild( finalLink );

	ikRoot.updateMatrixWorld( true );
	targetObject.matrix.set( ...finalLink.matrixWorld ).transpose();
	targetObject.matrix
		.decompose( targetObject.position, targetObject.quaternion, targetObject.scale );

	// TODO: rotation seems not to work here
	goal = new Goal();
	goal.makeClosure( finalLink );

	ikHelper = new IKRootsHelper( ikRoot );
	ikHelper.setResolution( window.innerWidth, window.innerHeight );
	ikHelper.traverse( c => {

		if ( c.material ) {

			c.material.color.set( 0xe91e63 ).convertSRGBToLinear();

		}

	} );
	scene.add( ikHelper );

	solver = new Solver( ikRoot );
	Object.assign( solver, solverOptions );

	function updateGoalDoF() {

		const dof = [];
		if ( params.solvePosition ) {

			dof.push( DOF.X, DOF.Y, DOF.Z );

		}

		if ( params.solveRotation ) {

			dof.push( DOF.EX, DOF.EY, DOF.EZ );

		}

		goal.setGoalDoF( ...dof );

	}

	updateGoalDoF();

	gui = new GUI();
	gui.width = 350;
	gui.add( params, 'controls', [ 'rotate', 'translate' ] ).listen().onChange( v => {

		transformControls.setMode( v );

	} );
	gui.add( params, 'solvePosition' ).onChange( updateGoalDoF );
	gui.add( params, 'solveRotation' ).onChange( updateGoalDoF );


	transformControls.addEventListener( 'mouseUp', () => {

		ikRoot.updateMatrixWorld( true );
		targetObject.matrix.set( ...finalLink.matrixWorld ).transpose();
		targetObject.matrix
			.decompose( targetObject.position, targetObject.quaternion, targetObject.scale );

	} );

	window.addEventListener( 'resize', () => {

		const w = window.innerWidth;
		const h = window.innerHeight;
		const aspect = w / h;

		renderer.setSize( w, h );

		camera.aspect = aspect;
		camera.updateProjectionMatrix();

		ikHelper.setResolution( window.innerWidth, window.innerHeight );

	} );

	window.addEventListener( 'keydown', e => {

		switch ( e.key ) {

			case 'w':
				transformControls.setMode( 'translate' );
				params.controls = 'translate';
				break;
			case 'e':
				transformControls.setMode( 'rotate' );
				params.controls = 'rotate';
				break;
			case 'f':
				controls.target.set( 0, 0, 0 );
				controls.update();
				break;

		}

	} );

}

function render() {

	requestAnimationFrame( render );

	goal.setPosition(
		targetObject.position.x,
		targetObject.position.y,
		targetObject.position.z,
	);
	goal.setQuaternion(
		targetObject.quaternion.x,
		targetObject.quaternion.y,
		targetObject.quaternion.z,
		targetObject.quaternion.w,
	);

	outputContainer.textContent = solver.solve().map( s => SOLVE_STATUS_NAMES[ s ] ).join( '\n' );

	renderer.render( scene, camera );
	stats.update();

}
