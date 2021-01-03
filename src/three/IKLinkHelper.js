import { mat4, vec3 } from 'gl-matrix';
import { Group, Matrix4 } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';

const glTempPos = new Float64Array( 3 );
const glTempMatrix = new Float64Array( 16 );
const tempMatrix = new Matrix4();
const tempParentMatrixWorld = new Matrix4();
export class IKLinkHelper extends Group {

	constructor( link ) {

		super();
		this.frame = link;

		const line = new Line2();
		line.geometry.setPositions( [
			0, 0, 0,
			0, 0, 0,
		] );
		line.material.color.set( 0xffffff );
		line.material.linewidth = 2;
		this.add( line );
		this.line = line;

	}

	update() {

		const { frame, line } = this;
		if ( frame.parent ) {

			glTempPos[ 0 ] = 0;
			glTempPos[ 1 ] = 0;
			glTempPos[ 2 ] = 0;

			mat4.invert( glTempMatrix, frame.matrix );
			vec3.transformMat4( glTempPos, glTempPos, glTempMatrix );

			line.geometry.setPositions( [
				...glTempPos,
				0, 0, 0,
			] );
			line.visible = true;

			if ( vec3.length( glTempPos ) < 1e-7 ) {

				line.visible = false;

			}

		} else {

			line.visible = false;

		}


	}

	updateMatrixWorld( ...args ) {

		const frame = this.frame;
		frame.updateMatrixWorld();
		if ( frame.isJoint ) {

			if ( frame.parent ) {

				tempMatrix.set( ...frame.matrix ).transpose();
				tempParentMatrixWorld.set( ...frame.parent.matrixWorld ).transpose();
				this.matrix.multiplyMatrices( tempParentMatrixWorld, tempMatrix );

			} else {

				tempMatrix.set( ...frame.matrix ).transpose();
				this.matrix.set( ...frame.matrix ).transpose();

			}

		} else {

			this.matrix.set( ...frame.matrixWorld ).transpose();

		}

		this.matrix.decompose( this.position, this.quaternion, this.scale );
		super.updateMatrixWorld( ...args );

	}

	dispose() {

		this.traverse( c => {

			if ( c.material ) {

				c.material.dispose();

			}

			if ( c.geometry ) {

				c.geometry.dispose();

			}

		} );

	}

}
