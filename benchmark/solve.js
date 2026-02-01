import { Link } from '../src/core/Link.js';
import { Joint, DOF } from '../src/core/Joint.js';
import { Goal } from '../src/core/Goal.js';
import { Solver } from '../src/core/Solver.js';
import { SOLVE_STATUS_NAMES } from '../src/core/ChainSolver.js';

// Build a serial arm with N joints and a goal at the end
function buildArm( numJoints = 6 ) {

	const root = new Link();
	root.name = 'root';

	let current = root;
	const joints = [];

	for ( let i = 0; i < numJoints; i ++ ) {

		const joint = new Joint();
		joint.name = `joint_${ i }`;
		// Alternate rotation axes for more complex motion
		joint.setDoF( i % 2 === 0 ? DOF.EZ : DOF.EX );
		joint.position[ 1 ] = 1; // 1 unit offset along Y
		joint.setMatrixNeedsUpdate();
		joints.push( joint );

		current.addChild( joint );

		const link = new Link();
		link.name = `link_${ i }`;
		joint.addChild( link );

		current = link;

	}

	// Initialize joints with slight bends to avoid singularities
	for ( let i = 0, l = joints.length; i < l; i ++ ) {

		// Alternate small positive/negative angles
		const angle = ( i % 2 === 0 ? 0.1 : - 0.1 );
		joints[ i ].setDoFValues( angle );
		joints[ i ].setMatrixDoFNeedsUpdate();

	}

	// Create end effector goal using Goal class (like the examples do)
	const endEffector = current;
	const goal = new Goal();
	goal.name = 'goal';
	goal.makeClosure( endEffector );

	// Position goal at end effector's initial world position
	root.updateMatrixWorld( true );
	endEffector.getWorldPosition( goal.position );
	endEffector.getWorldQuaternion( goal.quaternion );
	goal.setMatrixNeedsUpdate();

	return { root, goal, joints, endEffector };

}

// Set goal to a fixed reachable position
function setGoalPosition( goal, numJoints, iteration ) {

	const targets = [
		[ 1, numJoints - 1, 0 ],
		[ - 1, numJoints - 1, 0 ],
		[ 0, numJoints - 1, 1 ],
		[ 0, numJoints - 1, - 1 ],
		[ 0.5, numJoints - 0.5, 0.5 ],
	];

	const target = targets[ iteration % targets.length ];
	goal.position[ 0 ] = target[ 0 ];
	goal.position[ 1 ] = target[ 1 ];
	goal.position[ 2 ] = target[ 2 ];
	goal.setMatrixNeedsUpdate();

}

// Run benchmark
function runBenchmark( useAnalyticalJacobian, numJoints = 10, iterations = 100 ) {

	const { root, goal } = buildArm( numJoints );

	// Goal must be passed as a root so solver finds the closure chain
	const solver = new Solver( [ root, goal ] );
	solver.useAnalyticalJacobian = useAnalyticalJacobian;
	solver.maxIterations = 10;
	solver.restPoseFactor = 0.001;
	solver.dampingFactor = 0.01; // Higher damping for stability

	console.log( `  Chains found: ${ solver.solvers.length }` );
	console.log( `  Joints in chain: ${ solver.solvers[ 0 ].chain.length }` );

	// Warm up
	for ( let i = 0; i < 10; i ++ ) {

		setGoalPosition( goal, numJoints, i );
		solver.solve();

	}

	// Benchmark
	const times = [];
	const statusCounts = {};

	for ( let i = 0; i < iterations; i ++ ) {

		setGoalPosition( goal, numJoints, i );

		const start = performance.now();
		const results = solver.solve();
		const end = performance.now();

		times.push( end - start );

		for ( let j = 0, l = results.length; j < l; j ++ ) {

			const status = results[ j ];
			const statusName = SOLVE_STATUS_NAMES[ status ] ?? `unknown(${ status })`;
			statusCounts[ statusName ] = ( statusCounts[ statusName ] || 0 ) + 1;

		}

	}

	const avg = times.reduce( ( a, b ) => a + b, 0 ) / times.length;
	const min = Math.min( ...times );
	const max = Math.max( ...times );

	return { avg, min, max, statusCounts };

}

// Main
const NUM_JOINTS = 100;
const ITERATIONS = 100;

console.log( 'IK Solver Benchmark' );
console.log( '===================' );
console.log( `${ NUM_JOINTS }-DOF serial arm, ${ ITERATIONS } solves\n` );

console.log( 'Running with Numerical Jacobian...' );
const numerical = runBenchmark( false, NUM_JOINTS, ITERATIONS );
if ( numerical ) {

	console.log( `  Avg: ${ numerical.avg.toFixed( 3 ) }ms` );
	console.log( `  Min: ${ numerical.min.toFixed( 3 ) }ms` );
	console.log( `  Max: ${ numerical.max.toFixed( 3 ) }ms` );
	console.log( `  Status: ${ JSON.stringify( numerical.statusCounts ) }` );

}

console.log( '\nRunning with Analytical Jacobian...' );
const analytical = runBenchmark( true, NUM_JOINTS, ITERATIONS );
if ( analytical ) {

	console.log( `  Avg: ${ analytical.avg.toFixed( 3 ) }ms` );
	console.log( `  Min: ${ analytical.min.toFixed( 3 ) }ms` );
	console.log( `  Max: ${ analytical.max.toFixed( 3 ) }ms` );
	console.log( `  Status: ${ JSON.stringify( analytical.statusCounts ) }` );

}

if ( numerical && analytical ) {

	const speedup = ( ( numerical.avg - analytical.avg ) / numerical.avg * 100 ).toFixed( 1 );
	console.log( `\nAnalytical Jacobian speedup: ${ speedup }%` );

}
