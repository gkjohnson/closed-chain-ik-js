# Closed Chain Inverse Kinematics

[![build](https://img.shields.io/github/actions/workflow/status/gkjohnson/closed-chain-ik-js/node.js.yml?style=flat-square&label=build&branch=main)](https://github.com/gkjohnson/closed-chain-ik-js/actions)
[![github](https://flat.badgen.net/badge/icon/github?icon=github&label)](https://github.com/gkjohnson/closed-chain-ik-js/)
[![twitter](https://flat.badgen.net/badge/twitter/@garrettkjohnson/?icon&label)](https://twitter.com/garrettkjohnson)
[![sponsors](https://img.shields.io/github/sponsors/gkjohnson?style=flat-square&color=1da1f2)](https://github.com/sponsors/gkjohnson/)

A generalized inverse kinematics solver that supports closed chains for parallel kinematics systems, dynamic reconfiguration, and arbitrary joint configuration based on damped least squares error minimization techniques. Supports all variety of joints including combinations of rotation and translation degrees of freedom and is agnostic to visualization framework. Inspired by [Marty Vona's MSim research work](https://www2.ccs.neu.edu/research/gpc/MSim/MSim-info.html) and using techniques outlined in this [2009 paper by Samuel Buss](https://math.ucsd.edu/~sbuss/ResearchWeb/ikmethods/iksurvey.pdf). Developed with some aid and advice from [Marty Vona](https://www2.ccs.neu.edu/research/gpc/vona.html).

![](./images/banner.png)

_<p align="center">Solver being used on JPL's ATHLETE robot for full body IK</p>_

## Examples

[Hexapod demo](https://gkjohnson.github.io/closed-chain-ik-js/dist/hexapod.html)

[ATHLETE and Robonaut demo](https://gkjohnson.github.io/closed-chain-ik-js/dist/index.html)

[Rover mobility settling demo](https://gkjohnson.github.io/closed-chain-ik-js/dist/settling.html)

[VR demo](https://gkjohnson.github.io/closed-chain-ik-js/dist/vr.html)

[Partial degrees of freedom Goal demo](https://gkjohnson.github.io/closed-chain-ik-js/dist/goals.html)

## Model License Information

Robitics models used in the project are for demonstration purposes only and subject to the licenses of their respective projects.

[ATHLETE](https://github.com/gkjohnson/urdf-loaders/)

[Robonaut](https://github.com/gkjohnson/nasa-urdf-robots)

[Curiosity](https://github.com/gkjohnson/curiosity_mars_rover-mirror)

[Perseverance](https://github.com/gkjohnson/m2020-urdf-models)

[Staubli](https://github.com/ros-industrial/staubli_experimental)

[PI Hexapod](https://github.com/PI-PhysikInstrumente/PI_ROS_Driver)

[Digit](https://github.com/adubredu/DigitRobot.jl)

[Spot](https://github.com/heuristicus/spot_ros)

# Installation

```
npm install github:@gkjohnson/closed-chain-ik-js
```

# Use

## Simple 2 DoF System

```js
import { Solver, Joint, Link, Goal, DOF } from 'closed-chain-ik';

// Create links and joints
const link1 = new Link();

const joint1 = new Joint();
joint.setDoF( DOF.EZ );
joint.setPosition( 0, 1, 0 );
joint.setDoFValues( Math.PI / 4 );

const link2 = new Link();

const joint2 = new Joint();
joint.setDoF( DOF.EX );
joint.setPosition( 0, 1, 0 );
joint.setDoFValues( Math.PI / 4 );

const link3 = new Link();
link3.setPosition( 0, 1, 0 );

// Create the goal
const goal = new Goal();
link3.getWorldPosition( goal.position );
link3.getWorldQuaternion( goal.quaternion );

// Create structure
link1.addChild( joint1 );
joint1.addChild( link2 );
link2.addChild( joint2 );
joint2.addChild( link3 );

goal.makeClosure( link3 );

// create solver
const solver = new Solver( link1 );

// ...

// move the goal around and solve
goal.setPosition( 1, 2, 3 );
solver.solve();
```

## Using a WebWorker Solver

```js
import { WorkerSolve, Joint, Link, Goal, DOF } from 'closed-chain-ik';

// ... instantiate kinematic system...

const solver = new WorkerSolver( link1 );

// ...

// move the goal around and solve asynchronously
solver.solve();
```

# Caveats

- The web worker implementation uses ShareArrayBuffers which are not available on some platforms (Safari, Chrome for Android). See issue [#44](https://github.com/gkjohnson/closed-chain-ik-js/issues/44).

- Smoothing out 3DoF non closure ball joint behavior is in progress. See issue [#22](https://github.com/gkjohnson/closed-chain-ik-js/issues/22).

- Enabling SVD on the Solver can cause divergence on solvable systems and stutter. See [#76](https://github.com/gkjohnson/closed-chain-ik-js/issues/76).

# API

## Constants

### DOF

Enumerated fields representing different degrees of freedom for Joints.

```js
// Translation DoF
DOF.X, DOF.Y, DOF.Z,

// Euler Rotation DoF
DOF.EX, DOF.EY, DOF.EZ,
```

### DOF_NAMES

An array of strings representing the names of the above degrees of freedom.

### SOLVE_STATUS

Enumerated fields representing the state of a solve result.

```js
// Error for all goals are within
// the threshold.
SOLVE_STATUS.CONVERGED,

// Error for the goals has begun
// to diverge.
SOLVE_STATUS.DIVERGED,

// Resulting angles has not changed
// significantly enough to reach the
// stall threshold.
SOLVE_STATUS.STALLED,

// The solve has reached the maximum
// number of allowed iterations.
SOLVE_STATUS.TIMEOUT,
```

### SOLVE_STATUS_NAMES

An array of strings representing the names of the above solve statuses.

## IKUtils

Utility functions for working with IK systems. Available as `IKUtils.findRoots()`, `IKUtils.saveRestPose()`, or as direct imports.

### findRoots

```js
findRoots( frames : Array<Frame> ) : Array<Frame>
```

Takes an array of frames to traverse including the closure joints and links and finds a set of unique nodes to treat as the roots of the connected trees for use in solving.

### saveRestPose

```js
IKUtils.saveRestPose( ik : Frame ) : void
```

Traverses the IK tree and saves the current joint values as the rest pose for each joint. Sets `restPoseSet` to `true` on each joint.

## URDF Functions

Utility functions for creating an IK system from and working with results from [URDFLoader](https://github.com/gkjohnson/urdf-loaders/tree/master/javascript).

### urdfRobotToIKRoot

```js
urdfRobotToIKRoot( robot : URDFRobot, trimUnused : Boolean = false ) : Joint
```

Generates an IK three based on the provided `URDFRobot` with the root joint having a all 6 degrees of freedom set. Returns the root joint. If `trimUnused` is true then any dangling links that do not connect to non-fixed joints will be removed from the system.

### setUrdfFromIK

```js
setUrdfFromIK( robot : URDFRobot, ikRoot : Joint ) : void
```

Copies the joint values from `robot` onto `ikRoot` based on joint names.

### setIKFromUrdf

```js
setIKFromUrdf( ikRoot : Joint, robot : URDFRobot ) : void
```

Copies the joint values from `ikRoot` onto `robot` based on joint names.

## Frame

A base class for `Link`, `Joint`, and `Goal` representing a frame defined by a position and rotation in space.

### .position

```js
position : Float32Array[ 3 ]
```

The position of the frame. If this is modified directly `setMatrixNeedsUpdate()` must be called.

### .quaternion

```js
quaternion : Float32Array[ 4 ]
```

The orientation of the frame. If this is modified directly `setMatrixNeedsUpdate()` must be called.

### .matrix

```js
readonly matrix : Float32Array[ 16 ]
```

The local transform matrix composed from the position and quaternion.

### .matrixWorld

```js
readonly matrixWorld : Float32Array[ 16 ]
```

The world transform matrix computed based on the parent matrixWorld and this local matrix.

### .parent

```js
readonly parent : Frame
```

The parent frame this frame is a child of.

### .children

```js
readonly children : Array<Frame>
```

The set of child frames this frame is a parent of.

### .setPosition

```js
setPosition( x : Number, y : Number, z : Number ) : void
```

Sets the position of the frame.

### .setWorldPosition

```js
setWorldPosition( x : Number, y : Number, z : Number ) : void
```

Sets the positon of the frame in world space. Automatically computes the local position relative to the parent.

### .getWorldPosition

```js
getWorldPosition( target : FloatArray[ 3 ] ) : void
```

Gets the position of the frame in the world in the `target` argument.

### .setQuaternion

```js
setQuaternion( x : Number, y : Number, z : Number, w : Number ) : void
```

Sets the orientation of the frame.

### .setWorldQuaternion

```js
setWorldQuaternion( x : Number, y : Number, z : Number, w : Number ) : void
```

Sets the orientation of the frame in world space. Automatically computes the local orientation relative to the parent.

### .getWorldQuaternion

```js
getWorldQuaternion( target : FloatArray[ 4 ] ) : void
```

Gets the quaternion of the frame in the world in the `target` argument.

### .traverseParents

```js
traverseParents( callback : ( parent : Frame ) => Boolean ) : void
```

Fires the given callback for every parent starting with the closest. If `callback` returns true then the traversal is stopped.

### .traverse

```js
traverse( callback : ( child : Frame ) => Boolean ) : void
```

Fires the given callback for every child recursively in breadth first order. If `callback` returns true then the traversal is stopped.

### .addChild

```js
addChild( child : Frame ) : void
```

Adds a child to this frame and sets the childs parent to this frame. Throws an error if the child already has a parent.

### .removeChild

```js
removeChild( child : Frame ) : void
```

Removes the given child from this frame. Throws an error if the given frame is not a child of this frame.

### .attachChild

```js
attachChild( child : Frame ) : void
```

Adds the given frame as a child of this frame while preserving the world position of the child.

### .detachChild

```js
detachChild( child : Frame ) : void
```

Removes the given frame as a child of this frame while preserving the world position of the child.

### .updateMatrix

```js
updateMatrix() : void
```

Updates the local `.matrix` field if it needs to be updated.

### .updateMatrixWorld

```js
updateMatrixWorld( includeChildren : Boolean = false ) : void
```

Updates the local `.matrix` and `.worldMatrix` fields if they need to be updated. Ensures parent matrices are up to date.

### .setMatrixNeedsUpdate

```js
setMatrixNeedsUpdate() : void
```

Flags this frame as needing a matrix and matrix world update.

### .setMatrixWorldNeedsUpdate

```js
setMatrixNeedsUpdate() : void
```

Flags this frame and all its children as needing a matrix world update.

## Link

_extends [Frame](#Frame)_

A [Frame](#Frame) modeling a fixed connection between two [Joints](#Joint). Only [Joints](#Joint) may be added as children.

### .closureJoints

```js
closureJoints : Array<Joint>
```

The set of joints that are connected to this indirectly via `Joint.makeClosure`.

## Joint

_extends [Frame](#Frame)_

A dynamic [Frame](#Frame) representing a kinematic joint arbitrarily defineable degrees of freedom. A degree of freedom indicates an offset value can be set. Only [Links](#Link) may be added as children and a Joint may only have a single child.

### .child

```js
readonly child : Link = null
```

Reference to the joint child.

### .isClosure

```js
readonly isClosure : Boolean = false
```

Whether or not the child relationship is a closure or not.

### .dof

```js
readonly dof : Array<DOF>
```

A list of all the free degrees of freedom.

### .dofFlags

```js
readonly dofFlags : Uint8Array[6]
```

A list of `0` and `1` flags with `1` corresonding to a field in `dof`.

### .dofValues

```js
readonly dofValues : Float32Array[6]
```

The current joint values for all joint degrees of freedom.

### .dofTarget

```js
readonly dofTarget : Float32Array[6]
```

The joint value targets for each degree of freedom. [Solver](#Solver) will attempt to solve for these targets if [targetSet](#targetSet) is true.

### .dofRestPose

```js
readonly dofRestPose : Float32Array[6]
```

The rest pose for each joint degree of freedom. [Solver](#Solver) will attempt to move the joint towards this position when it does not compromise solving for the other goals and when [restPoseSet](#restPoseSet) is true.

### .minDoFLimit

```js
readonly minDoFLimit : Float32Array[6]
```

The minimum value limits for each joint degree of freeom.

### .maxDoFLimit

```js
readonly maxDoFLimit : Float32Array[6]
```

The maximum value limits for each joint degree of freeom.

### .matrixDoF

```js
readonly matrixDoF : Float32Array[16]
```

The matrix representing the transformation offset due to the current joint values.

### .targetSet

```js
targetSet : Boolean = false
```

When set to `true` [Solver](#Solver) will try to move this joints dofValues towards the target values.

### .restPoseSet

```js
restPoseSet : Boolean = false
```

When set to `true` [Solver](#Solver) will try to move this joints dofValues towards the rest pose values without compromising the other goals.

### .setDoF

```js
setDoF( ...dof : Array<DOF> ) : void
```

Sets the degrees of freedom of the joint. Arguments must be passed in X, Y, Z, EX, EY, EZ order without duplicate values. All relatd degree of freedom values are reset.

### .clearDoF

```js
clearDoF() : void
```

Clears all degrees of freedom.

### .set\[ \* \]Values

```js
setDoFValues( ...values : Array<Number> ) : void;
setRestPoseValues( ...values : Array<Number> ) : void;
setTargetValues( ...values : Array<Number> ) : void;
setMinLimits( ...values : Array<Number> ) : void;
setMaxLimits( ...values : Array<Number> ) : void;
```

The number of arguments must match the number of degrees of freedom of the joint.

### .set\[ \* \]Value

```js
setDoFValue( dof : DOF, value : Number ) : Boolean
setRestPoseValue( dof : DOF, value : Number ) : Boolean
setTargetValue( dof : DOF, value : Number ) : Boolean
setMinLimit( dof : DOF, value : Number ) : Boolean
setMaxLimit( dof : DOF, value : Number ) : Boolean
```

### .get\[ \* \]Value

```js
getDoFValue( dof : DOF ) : Number
getRestPoseValue( dof : DOF ) : Number
getTargetValue( dof : DOF ) : Number
getMinLimit( dof : DOF ) : Number
getMaxLimit( dof : DOF ) : Number
```

### .makeClosure

```js
makeClosure( child : Link ) : void
```

Declares the relationship between this joint and the given child link is a closure meaning there is no direct parent child relationship but the [Solver](#Solver) will treat the closure link as a target for this joint to keep them closed. The solver constrains all 6 axes (position + orientation) between this joint and the target link.

Note that when making a closure connection between a Joint and a Link the link will not be added to the Joints `children` array and instead will only be available on the `child` field. The Joint will be appended to the Links `closureJoints` array.

## Goal

_extends [Joint](#Joint)_

A [Frame](#Frame) representing a goal to achieve for a connected [Link](#Link). Set degrees of freedom represent fixed goals for a link to achieve as opposed to moveable degrees of freedom defined for [Joints](#Joint). A goal cannot have children and only be used to make a closure.

```js
goal.setFreeDoF();                        // All axes constrained (default)
goal.setFreeDoF(DOF.EX, DOF.EY, DOF.EZ);  // Position-only goal
goal.setFreeDoF(DOF.X, DOF.Y, DOF.Z);     // Rotation-only goal
```

Or use `setGoalDoF()` to specify constrained axes directly:

```js
goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);     // Position-only goal
```

## Solver

Class for solving the closure and target joint constraints of a sytem. As well as the listed fields a set of "options" are set on the object which are listed here:

```js
// Whether or not to use the SVD when calculating the pseudo inverse of the jacobian
// which can result in a more numerically stable calculation. If the SVD cannot be calculated
// then the transpose method is used.
useSVD = true;

// The max amount of iterations to try to solve for. The solve will terminate
// with SOLVE_STATUS.TIMEOUT if this limit is exceeded.
maxIterations = 5;

// The threshold under which a joint is not considered to have really moved. If
// no joint is moved more than this threshold then the solve will terminate with
// SOLVE_STATUS.STALLED.
stallThreshold = 1e-4;

// The threshold for comparing how much error has changed between solve iterations.
// If the error has grown by more than this threshold then the solve will terminate
// with SOLVE_STATUS.DIVERGED.
divergeThreshold = 0.01;

// The fixed damping factor to use in the DLS calculation.
dampingFactor = 0.001;

// The factor with which to move the joints towards the rest pose if set.
restPoseFactor = 0.01;

// The thresholds with which to compute whether or not the translation or rotation
// goals have been met. If the error between target and goal is under these
// thresholds then the solve will terminate with SOLVE_STATUS.CONVERGED.
translationConvergeThreshold = 1e-3;
rotationConvergeThreshold = 1e-5;

// Factors to apply to the translation and rotation error in the error vector.
// Useful for weighting rotation higher than translation if they do not seem to
// be solved "evenly". Values are expected to be in the range [ 0, 1 ].
translationFactor = 1;
rotationFactor = 1;

// The step to take towards the IK goals when solving. Setting this to a larger value
// may solve more quickly but may lead also lead to divergence.
translationErrorClamp = 0.1;
rotationErrorClamp = 0.1;
```

### .roots

```js
roots : Array<Frame>
```

The list of roots that should be accounted for in a solve. When `.updateStructure` is called the series of roots are traversed including closure joints to find all connected link hierarchies to use in the solve.

### .constructor

```js
constructor( roots : Array<Frame> )
```

Constructor takes a list of roots to solve for.

### .solve

```js
solve() : Array<SOLVE_STATUS>
```

Traverses the given set of roots to find joint chains to solve for and attempts to solve for the error in the system goals. A result is returned for each independent chain found in the system.

### .updateStructure

```js
updateStructure() : void
```

Must be called whenever parent child relationships and structural changes related to the tree change or `.roots` is modified.

## WorkerSolver

Implements the interface defined by [Solver](#Solver) but runs the solve asynchronously on in a WebWorker. Results are automatically copied to the joint system being solved for.

> :warning: When [SharedArrayBuffers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) are not available new copies of `ArrayBuffer` are created every update and from the worker.

### .results

```js
results : Array<Solve_STATUS>
```

The list of the last results from the solve copied over from the WebWorker.

### .updateSolverSettings

```js
updateSolverSettings( settings : Object ) : void
```

Sets the solver settings in the WebWorker to the values in the given object. Valid "options" values are listed in the [Solver](#Solver) docs.

### .updateFrameState

```js
updateFrameState( ...jointsToUpdate : Array<Joint> = [] ) : void
```

Copies the joint settings for the given joints to the WebWorker for a solve. "Joint settings" include everything except for joint values (that the solver would be solving for) and parent child relationships. If joint values or parent child relationhips change then `updateStructure` must be called.

### .solve

```js
solve() : void
```

Starts a solve in the WebWorker if one is not active. The solve will terminate automatically if none of the results are `SOLVE_STATUS.TIMEOUT`.

### .stop

```js
stop() : void
```

Terminate any active solve in the WebWorker.

### .dispose

```js
dispose() : void
```

Terminates the WebWorker and sets members to null.

## IKRootsHelper

_extends THREE.Group_

A helper class for rendering the joints and links in a three.js scene. Renders frame relationships as lines and joints degrees of freedom with indicators based on the joint type.

### .roots

```js
roots : Array<Frame>
```

Set of roots to render in the helper visualization. If this is changed then `.updateStructure` must be called.

### .constructor

```js
constructor( roots : Array<Frame> )
```

Takes the set of roots to visualize.

### .setJointScale

```js
setJointScale( scale : Number ) : this
```

Sets the scale of the joint indicators.

### .setColor

```js
setColor( color : Color | String | Number ) : this
```

Sets the color of the helper.


### .setDrawThrough

```js
setDrawThrough( drawThrough : Boolean ) : this
```

Sets whether the helper will draw through the environment.

### .updateStructure

```js
updateStructure() : void
```

Must be called if the structure of the IK system being visualized has changed.

### .dispose

```js
dispose() : void
```

Calls `dispose` on all created materials and geometry in the tree.
