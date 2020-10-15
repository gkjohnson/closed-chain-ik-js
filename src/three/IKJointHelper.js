import { BoxBufferGeometry, Vector3, CylinderBufferGeometry, SphereBufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { IKLinkHelper } from './IKLinkHelper.js';
import { DOF } from '../core/Joint.js';
import { HALF_PI } from '../core/utils/constants.js';

const tempPos = new Vector3();
const tempRot = new Vector3();
export class IKJointHelper extends IKLinkHelper {

	constructor( joint ) {

		super( joint );

		const xRotationMesh = new Mesh(
			new CylinderBufferGeometry( 0.05, 0.05, 0.25, 30, 1 ).rotateZ( HALF_PI ),
			new MeshStandardMaterial(),
		);

		const yRotationMesh = new Mesh(
			new CylinderBufferGeometry( 0.05, 0.05, 0.25, 30, 1 ),
			new MeshStandardMaterial(),
		);

		const zRotationMesh = new Mesh(
			new CylinderBufferGeometry( 0.05, 0.05, 0.25, 30, 1 ).rotateX( HALF_PI ),
			new MeshStandardMaterial(),
		);

		const freeRotationMesh = new Mesh(
			new SphereBufferGeometry( 0.05, 30, 30 ),
			new MeshStandardMaterial(),
		);

		const fixedMesh = new Mesh(
			new BoxBufferGeometry( 0.05, 0.05, 0.05 ),
			new MeshStandardMaterial(),
		);

		const translationMesh = new Line2();
		translationMesh.geometry.setPositions( [
			0, 0, 0,
			1, 0, 0,
			1, 1, 0,
			1, 1, 1,
		] );
		translationMesh.material.color.set( 0xffffff );
		translationMesh.material.side = 2;
		translationMesh.material.linewidth = 2;

		this.add(
			xRotationMesh,
			yRotationMesh,
			zRotationMesh,
			freeRotationMesh,
			translationMesh,
			fixedMesh,
		);

		this.xRotationMesh = xRotationMesh;
		this.yRotationMesh = yRotationMesh;
		this.zRotationMesh = zRotationMesh;
		this.translationMesh = translationMesh;
		this.freeRotationMesh = freeRotationMesh;
		this.fixedMesh = fixedMesh;

	}

	setJointScale( s ) {

		this.xRotationMesh.scale.setScalar( s );
		this.yRotationMesh.scale.setScalar( s );
		this.zRotationMesh.scale.setScalar( s );
		this.freeRotationMesh.scale.setScalar( s );
		this.fixedMesh.scale.setScalar( s );

	}

	update() {

		super.update();

		const {
			xRotationMesh,
			yRotationMesh,
			zRotationMesh,
			freeRotationMesh,
			translationMesh,
			fixedMesh,
		} = this;
		const joint = this.frame;
		xRotationMesh.visible = false;
		yRotationMesh.visible = false;
		zRotationMesh.visible = false;
		freeRotationMesh.visible = false;
		translationMesh.visible = false;
		fixedMesh.visible = false;

		if ( joint.translationDoFCount !== 0 ) {

			translationMesh.visible = true;

		}

		if ( joint.rotationDoFCount === 3 ) {

			freeRotationMesh.visible = true;
			window.ikRoot = this;

		} else {

			xRotationMesh.visible = Boolean( joint.dofFlags[ DOF.EX ] );
			yRotationMesh.visible = Boolean( joint.dofFlags[ DOF.EY ] );
			zRotationMesh.visible = Boolean( joint.dofFlags[ DOF.EZ ] );

		}

		if ( joint.translationDoFCount === 0 && joint.rotationDoFCount === 0 ) {

			// fixedMesh.visible = true;
			this.visible = this.line.visible;

		}

	}

	updateMatrixWorld( ...args ) {

		const {
			xRotationMesh,
			yRotationMesh,
			zRotationMesh,
			freeRotationMesh,
			translationMesh,
		} = this;
		const joint = this.frame;

		tempPos.set(
			joint.getDoFValue( DOF.X ),
			joint.getDoFValue( DOF.Y ),
			joint.getDoFValue( DOF.Z ),
		);

		tempRot.set(
			joint.getDoFValue( DOF.EX ),
			joint.getDoFValue( DOF.EY ),
			joint.getDoFValue( DOF.EZ ),
		);

		translationMesh.scale.copy( tempPos );

		xRotationMesh.position.copy( tempPos );

		yRotationMesh.position.copy( tempPos );
		yRotationMesh.rotation.set( tempRot.x, 0, 0 );

		zRotationMesh.position.copy( tempPos );
		zRotationMesh.rotation.set( tempRot.x, tempRot.y, 0 );

		freeRotationMesh.position.copy( tempPos );

		super.updateMatrixWorld( ...args );

	}

}
