import { Group, Vector2, Color } from 'three';
import { IKJointHelper } from './IKJointHelper.js';
import { IKLinkHelper } from './IKLinkHelper.js';
import { findRoots } from '../core/utils/findRoots.js';

const currLinks = new Set();
const currJoints = new Set();
export class IKRootsHelper extends Group {

	constructor( roots = [] ) {

		super();
		this.roots = Array.isArray( roots ) ? [ ...roots ] : [ roots ];
		this.joints = new Map();
		this.links = new Map();
		this.resolution = new Vector2( 1000, 1000 );
		this.drawThrough = false;
		this.color = new Color( 0xffffff );
		this.jointScale = 1;

		this.updateStructure();

	}

	_updateHelpers() {

		const { drawThrough, resolution, color, jointScale } = this;
		this.traverse( c => {

			const material = c.material;
			if ( material ) {

				material.color.copy( color );

				if ( material.isLineMaterial ) {

					material.uniforms.resolution.value.copy( resolution );

				}

				if ( drawThrough ) {

					material.opacity = 0.1;
					material.transparent = true;
					material.depthWrite = false;
					material.depthTest = false;

				} else {

					material.opacity = 1;
					material.transparent = false;
					material.depthWrite = true;
					material.depthTest = true;

				}

			}

			if ( c instanceof IKJointHelper ) {

				c.setJointScale( jointScale );

			}

		} );

	}

	setColor( c ) {

		if ( c.isColor ) {

			this.color.copy( c );

		} else {

			this.color.set( c );

		}

		this._updateHelpers();

		return this;

	}

	setJointScale( s ) {

		this.jointScale = s;
		this._updateHelpers();

		return this;

	}

	setDrawThrough( value ) {

		this.drawThrough = value;
		this._updateHelpers();

		return this;

	}

	setResolution( width, height ) {

		this.resolution.set( width, height );
		this._updateHelpers();

		return this;

	}

	updateStructure() {

		const { joints, links } = this;

		const roots = findRoots( this.roots );

		currJoints.clear();
		joints.forEach( ( helper, joint ) => currJoints.add( joint ) );

		currLinks.clear();
		links.forEach( ( helper, links ) => currLinks.add( links ) );

		for ( let i = 0, l = roots.length; i < l; i ++ ) {

			const root = roots[ i ];
			root.updateMatrixWorld( true );
			root.traverse( c => {

				if ( c.isJoint ) {

					let helper;
					if ( joints.has( c ) ) {

						helper = joints.get( c );

					} else {

						helper = new IKJointHelper( c );
						this.add( helper );
						joints.set( c, helper );

					}

					helper.update();
					currJoints.delete( c );

				} else {

					let helper;
					if ( links.has( c ) ) {

						helper = links.get( c );

					} else {

						helper = new IKLinkHelper( c );
						this.add( helper );
						links.set( c, helper );

					}

					helper.update();
					currLinks.delete( c );

				}

			} );

		}


		currJoints.forEach( joint => {

			const helper = joints.get( joint );
			this.remove( helper );
			helper.dispose();

		} );

		currLinks.forEach( link => {

			const helper = links.get( link );
			this.remove( helper );
			helper.dispose();

		} );

		this._updateHelpers();

	}

	dispose() {

		const { links, joints } = this;
		joints.forEach( ( [ joint, helper ] ) => {

			this.remove( helper );
			helper.dispose();

		} );
		joints.clear();

		links.forEach( ( [ link, helper ] ) => {

			this.remove( helper );
			helper.dispose();

		} );
		links.clear();

	}

}
