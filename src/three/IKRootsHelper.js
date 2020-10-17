import { Group, Vector2 } from 'three';
import { IKJointHelper } from './IKJointHelper.js';
import { IKLinkHelper } from './IKLinkHelper.js';

const currLinks = new Set();
const currJoints = new Set();
export class IKRootsHelper extends Group {

	constructor( roots = [] ) {

		super();
		this.roots = Array.isArray( roots ) ? [ ...roots ] : [ roots ];
		this.joints = new Map();
		this.links = new Map();
		this.resolution = new Vector2( 1000, 1000 );
		this.update();

	}

	setJointScale( s ) {

		this.traverse( c => {

			if ( c instanceof IKJointHelper ) {

				c.setJointScale( s );

			}

		} );

	}

	setResolution( width, height ) {

		this.resolution.set( width, height );
		this.traverse( c => {

			if ( c.material && c.material.isLineMaterial ) {

				c.material.uniforms.resolution.value.set( width, height );

			}

		} );

	}

	update() {

		const { roots, joints, links } = this;

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

		currJoints.forEach( ( [ joint, helper ] ) => {

			this.remove( helper );
			helper.dispose();

		} );

		currLinks.forEach( ( [ link, helper ] ) => {

			this.remove( helper );
			helper.dispose();

		} );

		this.setResolution( this.resolution.x, this.resolution.y );

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
