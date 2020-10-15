export function randomizeFrame( frame ) {

	frame.setPosition(
		Math.random(),
		Math.random(),
		Math.random(),
	);
	frame.setQuaternion(
		Math.random(),
		Math.random(),
		Math.random(),
		Math.random(),
	);

	if ( frame.isJoint ) {

		frame.setDoF( 0, 1, 2, 3, 4, 5 );
		frame.setMaxLimit(
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
		);
		frame.setMinLimit(
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
		);
		frame.setRestPoseValues(
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
		);
		frame.setTargetValues(
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
		);
		frame.setDoFValues(
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
			Math.random(),
		);

	}

}
