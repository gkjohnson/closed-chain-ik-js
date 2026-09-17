<!-- This file is generated automatically. Do not edit it directly. -->
# closed-chain-ik/three

## IKRootsHelper

_extends `Group`_

Renders the frames of an IK system in a three.js scene. Frame relationships are drawn as
lines and joints are drawn with indicators for their degrees of freedom.


### .roots

```js
roots: Array<Frame>
```

The roots to render. If modified `updateStructure` must be called.


### .constructor

```js
constructor( roots: Frame | Array<Frame> )
```

### .setColor

```js
setColor( color: Color | string | number ): IKRootsHelper
```

Sets the color of the helper.


### .setJointScale

```js
setJointScale( scale: number ): IKRootsHelper
```

Sets the scale of the joint indicators.


### .setDrawThrough

```js
setDrawThrough( drawThrough: boolean ): IKRootsHelper
```

Sets whether the helper is drawn on top of everything else in the scene.


### .updateStructure

```js
updateStructure(): void
```

Rebuilds the helpers for the frames in the roots. Must be called whenever the structure of
the rendered trees or `roots` change.


### .dispose

```js
dispose(): void
```

Disposes of every material and geometry created by the helper.


## URDFUtils

### urdfRobotToIKRoot

```js
urdfRobotToIKRoot( robot: URDFRobot, trimUnused = false: boolean ): Joint
```

Builds an IK tree from a `URDFRobot` and returns its root joint, which has all six degrees
of freedom set. Joint values on the robot are reflected in the tree.


### setIKFromUrdf

```js
setIKFromUrdf( ikRoot: Joint, robot: URDFRobot ): void
```

Copies the root transform and joint values from the robot onto the IK tree, matching joints
by name.


### setUrdfFromIK

```js
setUrdfFromIK( robot: URDFRobot, ikRoot: Joint ): void
```

Copies the root transform and joint values from the IK tree onto the robot, matching joints
by name.

