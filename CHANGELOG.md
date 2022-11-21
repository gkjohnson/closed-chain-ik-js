# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased
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
