<!-- This file is generated automatically. Do not edit it directly. -->
# closed-chain-ik/core

## Constants

### DOF

```js
DOF: Object<string, number>
```

Degrees of freedom that can be assigned to a joint.

```js
// Translation along an axis
DOF.X, DOF.Y, DOF.Z

// Euler rotation about an axis
DOF.EX, DOF.EY, DOF.EZ
```

### DOF_NAMES

```js
DOF_NAMES: Array<string>
```

Names of the degrees of freedom indexed by `DOF` value.

### SOLVE_STATUS

```js
SOLVE_STATUS: Object<string, number>
```

Statuses returned for each independent chain by `Solver.solve`.

```js
// Error for all goals is within the convergence thresholds.
SOLVE_STATUS.CONVERGED

// No joint moved more than the stall threshold or no joints are free to move.
SOLVE_STATUS.STALLED

// No step scale could keep the error within the divergence threshold.
SOLVE_STATUS.DIVERGED

// The maximum number of iterations was reached.
SOLVE_STATUS.TIMEOUT
```

### SOLVE_STATUS_NAMES

```js
SOLVE_STATUS_NAMES: Array<string>
```

Names of the solve statuses indexed by status value.

## Frame

Base class for `Link`, `Joint`, and `Goal` representing a frame defined by a position and
rotation in space.


### .name

```js
name: string
```

Name of the frame.


### .quaternion

```js
quaternion: Float32Array
```

Orientation of the frame relative to its parent. If modified directly
`setMatrixNeedsUpdate` must be called.


### .position

```js
position: Float32Array
```

Position of the frame relative to its parent. If modified directly
`setMatrixNeedsUpdate` must be called.


### .matrix

```js
readonly matrix: Float32Array
```

Local transform matrix composed from the position and quaternion.


### .matrixWorld

```js
readonly matrixWorld: Float32Array
```

World transform matrix computed from the parent world matrix and the local matrix.


### .parent

```js
readonly parent: Frame | null
```

The frame this frame is a child of.


### .children

```js
readonly children: Array<Frame>
```

The frames this frame is a parent of.


### .setPosition

```js
setPosition( x: number, y: number, z: number ): void
```

Sets the position of the frame relative to its parent.


### .setEuler

```js
setEuler( x: number, y: number, z: number ): void
```

Sets the orientation of the frame relative to its parent from Euler angles in radians.


### .setQuaternion

```js
setQuaternion( x: number, y: number, z: number, w: number ): void
```

Sets the orientation of the frame relative to its parent.


### .setWorldPosition

```js
setWorldPosition( x: number, y: number, z: number ): void
```

Sets the position of the frame in world space. The local position relative to the parent
is computed automatically.


### .setWorldEuler

```js
setWorldEuler( x: number, y: number, z: number ): void
```

Sets the orientation of the frame in world space from Euler angles in radians. The local
orientation relative to the parent is computed automatically.


### .setWorldQuaternion

```js
setWorldQuaternion( x: number, y: number, z: number, w: number ): void
```

Sets the orientation of the frame in world space. The local orientation relative to the
parent is computed automatically.


### .getWorldPosition

```js
getWorldPosition( target: Array<number> | Float32Array ): void
```

Writes the position of the frame in world space into `target`.


### .getWorldQuaternion

```js
getWorldQuaternion( target: Array<number> | Float32Array ): void
```

Writes the orientation of the frame in world space into `target`.


### .traverseParents

```js
traverseParents( callback: ( frame: Frame ) => boolean ): void
```

Calls `callback` for every ancestor starting with the parent. Returning `true` from the
callback stops the traversal.


### .traverse

```js
traverse( callback: ( frame: Frame ) => boolean ): void
```

Calls `callback` for this frame and every descendant in breadth first order. Returning
`true` from the callback stops traversal below that frame.


### .find

```js
find( callback: ( frame: Frame ) => boolean ): Frame | null
```

Returns the first frame in the tree, including this one, for which `callback` returns
`true`, or `null` if none does.


### .addChild

```js
addChild( child: Frame ): void
```

Adds a child to this frame and sets its parent to this frame. Throws if the child already
has a parent.


### .removeChild

```js
removeChild( child: Frame ): void
```

Removes the given child from this frame. Throws if the frame is not a child of this frame.


### .attachChild

```js
attachChild( child: Frame ): void
```

Adds the given frame as a child while preserving its world transform.


### .detachChild

```js
detachChild( child: Frame ): void
```

Removes the given child while preserving its world transform.


### .setMatrixNeedsUpdate

```js
setMatrixNeedsUpdate(): void
```

Flags this frame as needing its local and world matrices updated.


### .setMatrixWorldNeedsUpdate

```js
setMatrixWorldNeedsUpdate(): void
```

Flags this frame and all its descendants as needing their world matrices updated.


### .updateMatrix

```js
updateMatrix(): void
```

Updates the local matrix if it has been flagged as needing an update.


### .updateMatrixWorld

```js
updateMatrixWorld( updateChildren = false: boolean ): void
```

Updates the local and world matrices if they have been flagged as needing an update,
updating parent matrices first as needed.


## Joint

_extends [`Frame`](#frame)_

A frame representing a kinematic joint with any combination of degrees of freedom. Each
degree of freedom is an offset applied on top of the frame transform. Only links may be
added as children and a joint may only have a single child.


### .child

```js
readonly child: Link | null
```

The child link of the joint, whether added directly or through `makeClosure`.


### .isClosure

```js
readonly isClosure: boolean
```

Whether the child relationship is a closure made with `makeClosure`.


### .rotationDoFCount

```js
readonly rotationDoFCount: number
```

Number of rotation degrees of freedom set on the joint.


### .translationDoFCount

```js
readonly translationDoFCount: number
```

Number of translation degrees of freedom set on the joint.


### .dof

```js
readonly dof: Array<number>
```

The degrees of freedom set on the joint in `DOF` order.


### .dofFlags

```js
readonly dofFlags: Uint8Array
```

Flags indexed by `DOF` value that are `1` when the degree of freedom is set.


### .dofValues

```js
readonly dofValues: Float32Array
```

Current values of each degree of freedom indexed by `DOF` value. If modified directly
`setMatrixDoFNeedsUpdate` must be called.


### .dofTarget

```js
readonly dofTarget: Float32Array
```

Target value of each degree of freedom indexed by `DOF` value. The solver moves the
joint toward these when `targetSet` is true.


### .dofRestPose

```js
readonly dofRestPose: Float32Array
```

Rest pose of each degree of freedom indexed by `DOF` value. The solver moves the joint
toward these when `restPoseSet` is true and it does not compromise the other goals.


### .minDoFLimit

```js
readonly minDoFLimit: Float32Array
```

Minimum limit of each degree of freedom indexed by `DOF` value.


### .maxDoFLimit

```js
readonly maxDoFLimit: Float32Array
```

Maximum limit of each degree of freedom indexed by `DOF` value.


### .targetSet

```js
targetSet: boolean = false
```

Whether the solver should move the joint toward `dofTarget`.


### .restPoseSet

```js
restPoseSet: boolean = false
```

Whether the solver should move the joint toward `dofRestPose`.


### .matrixDoF

```js
readonly matrixDoF: Float32Array
```

Transform offset produced by the current degree of freedom values.


### .clearDoF

```js
clearDoF(): void
```

Removes all degrees of freedom from the joint.


### .setDoF

```js
setDoF( ...dof: number ): void
```

Sets the degrees of freedom of the joint and resets all related values and limits.
Arguments must be in `X`, `Y`, `Z`, `EX`, `EY`, `EZ` order without duplicates.


### .setDoFValues

```js
setDoFValues( ...values: number ): void
```

Sets the value of every degree of freedom in `dof` order, clamped to the joint limits.


### .setDoFValue

```js
setDoFValue( dof: number, value: number ): boolean
```

Sets the value of a degree of freedom, clamped to the joint limits.


### .getDoFValue

```js
getDoFValue( dof: number ): number
```

Returns the value of a degree of freedom.


### .getDoFQuaternion

```js
getDoFQuaternion( target: Array<number> | Float32Array ): void
```

Writes the rotation degree of freedom values as a quaternion into `target`.


### .getDoFEuler

```js
getDoFEuler( target: Array<number> | Float32Array ): void
```

Writes the rotation degree of freedom values as Euler angles into `target`.


### .getDoFPosition

```js
getDoFPosition( target: Array<number> | Float32Array ): void
```

Writes the translation degree of freedom values into `target`.


### .setRestPoseValues

```js
setRestPoseValues( ...values: number ): void
```

Sets the rest pose of every degree of freedom in `dof` order, clamped to the joint limits.


### .setRestPoseValue

```js
setRestPoseValue( dof: number, value: number ): boolean
```

Sets the rest pose of a degree of freedom, clamped to the joint limits.


### .getRestPoseValue

```js
getRestPoseValue( dof: number ): number
```

Returns the rest pose of a degree of freedom.


### .getRestPoseQuaternion

```js
getRestPoseQuaternion( target: Array<number> | Float32Array ): void
```

Writes the rotation rest pose as a quaternion into `target`.


### .getRestPoseEuler

```js
getRestPoseEuler( target: Array<number> | Float32Array ): void
```

Writes the rotation rest pose as Euler angles into `target`.


### .getRestPosePosition

```js
getRestPosePosition( target: Array<number> | Float32Array ): void
```

Writes the translation rest pose into `target`.


### .setTargetValues

```js
setTargetValues( ...values: number ): void
```

Sets the target of every degree of freedom in `dof` order, clamped to the joint limits.


### .setTargetValue

```js
setTargetValue( dof: number, value: number ): void
```

Sets the target of a degree of freedom, clamped to the joint limits.


### .getTargetValue

```js
getTargetValue( dof: number ): number
```

Returns the target of a degree of freedom.


### .getTargetQuaternion

```js
getTargetQuaternion( target: Array<number> | Float32Array ): void
```

Writes the rotation target as a quaternion into `target`.


### .getTargetEuler

```js
getTargetEuler( target: Array<number> | Float32Array ): void
```

Writes the rotation target as Euler angles into `target`.


### .getTargetPosition

```js
getTargetPosition( target: Array<number> | Float32Array ): void
```

Writes the translation target into `target`.


### .setMinLimits

```js
setMinLimits( ...values: number ): void
```

Sets the minimum limit of every degree of freedom in `dof` order.


### .setMinLimit

```js
setMinLimit( dof: number, value: number ): void
```

Sets the minimum limit of a degree of freedom and clamps the current value to it.


### .getMinLimit

```js
getMinLimit( dof: number ): number
```

Returns the minimum limit of a degree of freedom.


### .setMaxLimits

```js
setMaxLimits( ...values: number ): void
```

Sets the maximum limit of every degree of freedom in `dof` order.


### .setMaxLimit

```js
setMaxLimit( dof: number, value: number ): void
```

Sets the maximum limit of a degree of freedom and clamps the current value to it.


### .getMaxLimit

```js
getMaxLimit( dof: number ): number
```

Returns the maximum limit of a degree of freedom.


### .setMatrixDoFNeedsUpdate

```js
setMatrixDoFNeedsUpdate(): void
```

Flags the joint as needing its degree of freedom matrix and world matrix updated.


### .makeClosure

```js
makeClosure( child: Link ): void
```

Connects the given link to this joint as a closure. The link is not added to `children`
and keeps its own parent, but is set as `child` and the joint is appended to the link's
`closureJoints`. The solver constrains all six axes between the joint and the link to
keep the closure closed.


### .addChild

```js
addChild( child: Link ): void
```

Adds a link as the child of this joint. Throws if the child is not a link or the joint
already has a child.


## Goal

_extends [`Joint`](#joint)_

A frame representing a target for a connected link to reach. The degrees of freedom set on
a goal are the axes that are constrained, as opposed to the movable degrees of freedom of a
joint. A goal cannot have children and can only be connected to a link with `makeClosure`.

```js
goal.setFreeDoF();                          // all axes constrained ( default )
goal.setFreeDoF( DOF.EX, DOF.EY, DOF.EZ );  // position only goal
goal.setGoalDoF( DOF.X, DOF.Y, DOF.Z );     // position only goal
```


### .setGoalDoF

```js
setGoalDoF( ...dof: number ): void
```

Sets the axes the goal constrains. Rotation must be constrained on all three axes or
none, so `EX`, `EY`, and `EZ` must be passed together or omitted.


### .setFreeDoF

```js
setFreeDoF( ...dof: number ): void
```

Sets the axes the goal leaves free. Every other axis is constrained. The same rotation
restriction as `setGoalDoF` applies.


## Link

_extends [`Frame`](#frame)_

A frame modeling a fixed connection between joints. Only joints may be added as children.


### .closureJoints

```js
readonly closureJoints: Array<Joint>
```

Joints connected to this link through `Joint.makeClosure`.


### .addChild

```js
addChild( child: Joint ): void
```

Adds a joint as a child of this link. Throws if the child is not a joint.


## Solver

Solves the closure and joint target constraints of a system of frames using damped least
squares. Every independent chain of joints found in the roots is solved separately.


### .useSVD

```js
useSVD: boolean = false
```

Use the SVD to compute the damped pseudo inverse of the jacobian, which adds damping in
near singular directions to keep steps bounded near singularities. Falls back to the
transpose method if the SVD cannot be computed.


### .maxIterations

```js
maxIterations: number = 5
```

Maximum number of iterations per solve. The solve terminates with
`SOLVE_STATUS.TIMEOUT` when exceeded.


### .stallThreshold

```js
stallThreshold: number = 1e-4
```

If no joint moves more than this in an iteration the solve terminates with
`SOLVE_STATUS.STALLED`.


### .dampingFactor

```js
dampingFactor: number = 0.001
```

Base damping factor of the damped least squares solve.


### .divergeThreshold

```js
divergeThreshold: number = 0.01
```

Amount the error may grow in a single step before the step is rejected and retried at
a smaller scale. If no scale keeps the error within this threshold the solve terminates
with `SOLVE_STATUS.DIVERGED`.


### .restPoseFactor

```js
restPoseFactor: number = 0.01
```

Factor with which joints that have a rest pose set are moved toward it without
compromising the other goals.


### .translationConvergeThreshold

```js
translationConvergeThreshold: number = 1e-3
```

Translation error under which a goal is considered met. The solve terminates with
`SOLVE_STATUS.CONVERGED` when every goal is met.


### .rotationConvergeThreshold

```js
rotationConvergeThreshold: number = 1e-5
```

Rotation error under which a goal is considered met. The solve terminates with
`SOLVE_STATUS.CONVERGED` when every goal is met.


### .translationFactor

```js
translationFactor: number = 1
```

Weight applied to translation error. Useful for balancing translation against rotation
when one is solved for more strongly than the other. Expected to be in `[ 0, 1 ]`.


### .rotationFactor

```js
rotationFactor: number = 1
```

Weight applied to rotation error. Useful for balancing rotation against translation
when one is solved for more strongly than the other. Expected to be in `[ 0, 1 ]`.


### .translationErrorClamp

```js
translationErrorClamp: number = 0.1
```

Maximum translation error targeted in a single step. Larger values may solve faster but
are more likely to overshoot.


### .rotationErrorClamp

```js
rotationErrorClamp: number = 0.1
```

Maximum rotation error targeted in a single step. Larger values may solve faster but
are more likely to overshoot.


### .roots

```js
roots: Array<Frame>
```

The roots to solve for. When `updateStructure` is called the roots are traversed,
including closure connections, to find every connected tree. If modified
`updateStructure` must be called.


### .constructor

```js
constructor( roots: Frame | Array<Frame> )
```

### .updateStructure

```js
updateStructure(): void
```

Rebuilds the joint chains to solve. Must be called whenever the parent child structure of
the trees, the degrees of freedom of a joint, or `roots` change.


### .solve

```js
solve(): Array<number>
```

Runs a solve on every independent joint chain and returns a `SOLVE_STATUS` for each.


## IKUtils

### findRoots

```js
findRoots( frames: Array<Frame> ): Array<Frame>
```

Finds the unique roots of the trees the given frames belong to, following closure
connections so every connected tree is included.


### saveRestPose

```js
saveRestPose( root: Frame ): void
```

Saves the current joint values of every joint in the tree as its rest pose and sets
`restPoseSet` to `true`.

