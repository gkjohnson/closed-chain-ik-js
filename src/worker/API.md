<!-- This file is generated automatically. Do not edit it directly. -->
# closed-chain-ik/worker

## WorkerSolver

Runs the `Solver` asynchronously in a WebWorker. The worker owns a copy of the frames and the
resulting joint values are copied back onto the frames on the main thread as solves complete.

> [!WARNING]
> When `SharedArrayBuffer` is not available a new `ArrayBuffer` is copied to the worker
> on every update and back with every result.

### .roots

```js
roots: Array<Frame>
```

The roots to solve for. If modified `updateStructure` must be called.


### .status

```js
readonly status: Array<number>
```

The `SOLVE_STATUS` of each chain from the most recent solve in the worker.


### .running

```js
readonly running: boolean
```

Whether a solve is running in the worker.


### .constructor

```js
constructor( roots: Frame | Array<Frame> )
```

### .updateStructure

```js
updateStructure(): void
```

Sends the structure of the trees to the worker. Must be called whenever the parent child
structure, the degrees of freedom of a joint, or the joint values are changed on the main
thread.


### .updateSolverSettings

```js
updateSolverSettings( settings: Object ): void
```

Sets the given `Solver` options on the solver in the worker.


### .updateFrameState

```js
updateFrameState( ...frames: Frame ): void
```

Copies the frame transforms and joint settings, everything except the joint values being
solved for, to the worker. Copies every frame if none are given.


### .solve

```js
solve(): void
```

Starts a solve loop in the worker if one is not running. The loop stops on its own once no
chain returns `SOLVE_STATUS.TIMEOUT`.


### .stop

```js
stop(): void
```

Stops the solve loop in the worker.


### .dispose

```js
dispose(): void
```

Stops the solve loop and terminates the worker.

