# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.0.7] - 2026-09-17
### Added
- "closed-chain-ik/core", "closed-chain-ik/three", and "closed-chain-ik/worker" entry points so the three.js and worker code can be imported separately.

### Changed
- "WorkerSolver" must now be imported from "closed-chain-ik/worker" instead of the root entry point.
- Steps that increase the error are retried at smaller scales within the same iteration instead of being reverted and shrinking every following step.
- SVD solves damp near singular directions with a threshold that adapts as steps are rejected or accepted so steps stay bounded near singularities.

### Fixed
- "useSVD" silently falling back to damped least squares when there are more free DoF than constraint rows.
- Jacobian columns for joints above a closure fork only accounting for one side of the closure.
- Solver throwing when a chain has no free degrees of freedom or when a joint with "targetSet" is part of a solved chain, and target joints stepping away from their targets.
- Target joint rotation error using a signed sum so opposing or negative errors could report as converged.
- Cached Jacobian pseudo inverse being reused after "dampingFactor" or "useSVD" changed.
- Frame.setWorldQuaternion producing the wrong result when the frame already had a local rotation, and Frame.traverseParents leaving shared traversal state in use after an early stop.
- Joint.getDoFQuaternion, getRestPoseQuaternion, and getTargetQuaternion treating radians as degrees.
- URDFUtils.setIKFromUrdf not transferring the root rotation to the IK root DoF.
- WorkerSolver.stop not stopping the worker and "running" being cleared prematurely.
- IKRootsHelper.dispose throwing and removed helpers being retained after updateStructure.

## [0.0.6] - 2026-02-02
### Added
- Basic benchmark for solve.
- Used damped pseudo inverse for SVD case.
- Make progressively smaller step sizes towards goals if an IK chain is diverging.
- Jacobian pseudo inverse caching for opportunistic performance gain.
- Added "saveRestPose" to "IKUtils" export.

### Changed
- Simplified internal Matrix initialization.
- Use analytic Jacobian.
- Remove "translationStep" and "rotatinoStep" options.
- Use a simplified formulation for rest pose calculations for a significant speed up when using rest pose.
- Move "findRoots" to "IKUtils" export.
- Moved "urdfRobotToIKRoot", "setUrdfFromIK", "setIKFromUrdf" to URDFUtils export.
- URDFUtils.setIKFromUrdf: Root DoF values are now set with taking the IK root into account.
- URDFUtils.urdfRobotToIKRoot: The produced IK system now accounts for any existing changes to the URDF joint values.

### Fixed
- Fixed case where Matrices were not zeroed out when fetched from MatrixPool, possibly causing some outdated values to be used in calculations.

## [0.0.5] - 2025-07-18
### Fixed
- Adjust package version requirements.
- Set the type and module entry in the package.
- Updated the project to work with three.js r159 and up.

### Changed
- Removed `IKRootsHelper.setResolution`.

## [0.0.4] - 2022-11-21
### Added

- Better error messages.
- Typescript definition files.
- Functions for setting draw through and color on `IKRootsHelper`.

### Fixed

- IKRootsHelper throwing an error when calling `updateStructure`.
- IKRootsHelper throwing an error when calling `dispose`.
- Support for prismatic joints when assigning the ik state to URDF joints.

### Changed

- Disabled SVD by default on Solver because it was causing solves to diverge.

## [0.0.3] - 2020-12-31
### Changed

- Frame and Joint matrices from using `Float64Array` to using `Float32Array`.
- Added `matrixPool` onto `Solver` and `ChainSolver` instances so they are not retained globally.
- WorkerSolver now falls back to clone `ArrayBuffers` when `SharedArrayBuffers` are not available.

### Fixed

- `useSVD` option not be set onto Solver's ChainSolvers.
- `useSVD` option will fall back to non SVD pseudoinverse if SVD fails to be computed.
- Removed ability to set unmoveable DoF on Joints.
- Removed unmoveable joints from solve.

## [0.0.2] - 2020-12-28
### Added

- `findRoots` function for finding unique connected hierarchy roots from a set of frames.
- `useSVD` option for Solvers.

### Fixed

- Joint rest pose not being applied correctly resulting in the solver often not converging.

### Changed

- Closure links are no longer added to the Joint children array.
- All connected roots no longer have to be manually added to the IKRootsHelper or Solvers.
- Renamed `IKRootsHelper.update` to `IKRootsHelper.updateStructure`.

## [0.0.1] - 2020-10-17

Initial release
