export function saveRestPose( ik ) {

	ik.traverse( c => {

		if ( c.isJoint ) {

			c.dofRestPose.set( c.dofValues );
			c.restPoseSet = true;

		}

	} );

}
