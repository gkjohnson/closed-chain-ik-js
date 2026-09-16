import { mat4, quat } from 'gl-matrix';
import { Joint, DOF } from '../core/Joint.js';
import { Link } from '../core/Link.js';
import { getEuler } from '../core/utils/glmatrix.js';
import { DEG2RAD } from '../core/utils/constants.js';

const tempVec = new Float64Array( 3 );
const tempVec2 = new Float64Array( 3 );
const tempQuat = new Float64Array( 4 );
const tempMatrix = new Float64Array( 16 );

export function urdfRobotToIKRoot( urdfNode, trimUnused = false, isRoot = true ) {

	let rootNode = null;
	let node;
	let doReturn = true;

	// if this is the root then we need to reset all the joints so we
	// can initialize our IK from a default "0" state
	let savedJoints = null;
	if ( isRoot ) {

		savedJoints = {};
		urdfNode.traverse( c => {

			if ( c.isURDFJoint ) {

				savedJoints[ c.name ] = {
					ignoreLimits: c.ignoreLimits,
					values: [ ...c.jointValue ],
				};

				c.ignoreLimits = true;
				c.setJointValue( 0, 0, 0, 0, 0, 0 );

			}

		} );

		urdfNode.updateMatrixWorld( true );

	}

	if ( urdfNode.isURDFRobot ) {

		rootNode = new Joint();
		rootNode.name = '__world_joint__';
		rootNode.setDoF( DOF.X, DOF.Y, DOF.Z, DOF.EX, DOF.EY, DOF.EZ );

		node = new Link();
		node.name = urdfNode.name;

		rootNode.addChild( node );

	} else if ( urdfNode.isURDFLink ) {

		node = new Link();
		node.name = urdfNode.name;
		doReturn = ! trimUnused;

	} else if ( urdfNode.isURDFJoint ) {

		rootNode = new Joint();

		const jointType = urdfNode.jointType;
		switch ( jointType ) {

			case 'continuous':
			case 'revolute':
			case 'prismatic': {

				const link = new Link();
				rootNode.addChild( link );

				const joint = new Joint();
				joint.name = urdfNode.name;
				link.addChild( joint );

				const fixedLink = new Link();
				joint.addChild( fixedLink );

				const fixedJoint = new Joint();
				fixedLink.addChild( fixedJoint );

				tempVec[ 0 ] = 0;
				tempVec[ 1 ] = 0;
				tempVec[ 2 ] = 1;

				tempVec2[ 0 ] = urdfNode.axis.x;
				tempVec2[ 1 ] = urdfNode.axis.y;
				tempVec2[ 2 ] = urdfNode.axis.z;

				// orient the joint such that +Z is pointing down the URDF rotation axis
				quat.rotationTo( joint.quaternion, tempVec, tempVec2 );
				quat.invert( fixedJoint.quaternion, joint.quaternion );
				joint.setMatrixNeedsUpdate();
				fixedJoint.setMatrixNeedsUpdate();

				if ( jointType === 'revolute' || jointType === 'continuous' ) {

					joint.setDoF( DOF.EZ );

				} else {

					joint.setDoF( DOF.Z );

				}

				if ( jointType !== 'continuous' ) {

					joint.setMinLimits( urdfNode.limit.lower );
					joint.setMaxLimits( urdfNode.limit.upper );

				}

				node = fixedJoint;
				break;

			}

			case 'fixed': {

				node = rootNode;
				doReturn = ! trimUnused;
				break;

			}

			case 'planar':
			case 'floating':
			default:

				console.error( `urdfRobotToIKRoot: Joint type ${jointType} not supported.` );
				doReturn = ! trimUnused;

		}

	} else {

		return null;

	}

	// position the nodes
	// even the root node is positioned even though it's marked as a free DoF in order to align
	// with the robots positioning - and the user may mark it as "fixed" afterward.
	( rootNode || node ).setPosition(
		urdfNode.position.x,
		urdfNode.position.y,
		urdfNode.position.z,
	);

	( rootNode || node ).setQuaternion(
		urdfNode.quaternion.x,
		urdfNode.quaternion.y,
		urdfNode.quaternion.z,
		urdfNode.quaternion.w,
	);

	const children = urdfNode.children;
	for ( let i = 0, l = children.length; i < l; i ++ ) {

		const res = urdfRobotToIKRoot( children[ i ], trimUnused, false );

		if ( res ) {

			node.addChild( res );
			doReturn = true;

		}

	}

	// reset all the joint angles
	if ( isRoot ) {

		urdfNode.traverse( c => {

			if ( c.isURDFJoint ) {

				const { values, ignoreLimits } = savedJoints[ c.name ];
				c.setJointValue( ...values );
				c.ignoreLimits = ignoreLimits;

			}

		} );

		urdfNode.updateMatrixWorld( true );

	}

	return ( ! trimUnused || doReturn ) ? rootNode || node : null;

}

export function setIKFromUrdf( ikRoot, urdfRoot ) {

	// get the urdf root transform relative to the ik root frame
	urdfRoot.updateMatrix();
	ikRoot.updateMatrix();
	mat4.invert( tempMatrix, ikRoot.matrix );
	mat4.multiply( tempMatrix, tempMatrix, urdfRoot.matrix.elements );

	// set the root DoF so the ik root world transform matches the urdf root
	mat4.getTranslation( tempVec, tempMatrix );
	mat4.getRotation( tempQuat, tempMatrix );
	getEuler( tempVec2, tempQuat );

	ikRoot.setDoFValue( DOF.X, tempVec[ 0 ] );
	ikRoot.setDoFValue( DOF.Y, tempVec[ 1 ] );
	ikRoot.setDoFValue( DOF.Z, tempVec[ 2 ] );

	ikRoot.setDoFValue( DOF.EX, tempVec2[ 0 ] * DEG2RAD );
	ikRoot.setDoFValue( DOF.EY, tempVec2[ 1 ] * DEG2RAD );
	ikRoot.setDoFValue( DOF.EZ, tempVec2[ 2 ] * DEG2RAD );

	ikRoot.traverse( c => {

		if ( c.isJoint ) {

			const name = c.name;
			if ( name in urdfRoot.joints ) {

				c.setDoFValues( urdfRoot.joints[ name ].angle );

			}

		}

	} );

}

export function setUrdfFromIK( urdfRoot, ikRoot ) {

	ikRoot.updateMatrixWorld();
	urdfRoot.matrix.set( ...ikRoot.matrixWorld ).transpose();
	urdfRoot.matrix.decompose(
		urdfRoot.position,
		urdfRoot.quaternion,
		urdfRoot.scale,
	);

	ikRoot.traverse( c => {

		if ( c.isJoint ) {

			const ikJoint = c;
			const urdfJoint = urdfRoot.joints[ c.name ];
			if ( urdfJoint ) {

				if ( urdfJoint.jointType === 'prismatic' ) {

					urdfJoint.setJointValue( ikJoint.getDoFValue( DOF.Z ) );

				} else {

					urdfJoint.setJointValue( ikJoint.getDoFValue( DOF.EZ ) );

				}

			}

		}

	} );

}
