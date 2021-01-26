/* eslint-disable */
// https://github.com/gkjohnson/webxr-sandbox

import {
	Bone,
	SkinnedMesh,
	Group,
	BufferAttribute,
	Skeleton,
	Box3,
	Matrix4,
	Sphere,
	BufferGeometry,
} from 'three';
import {
	BufferGeometryUtils,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const inverseMatrix = new Matrix4();
class ProxySkinnedMesh extends SkinnedMesh {

	constructor( geometry, material, meshes ) {

		super( geometry, material );
		this.proxied = meshes;

	}

	raycast( ...args ) {

		const { proxied } = this;
		for ( let i = 0, l = proxied.length; i < l; i ++ ) {

			const mesh = proxied[ i ];
			mesh.raycast( ...args );

		}

	}

	updateMatrixWorld( ...args ) {

		super.updateMatrixWorld( ...args );

		const { geometry, matrixWorld, proxied, frustumCulled } = this;
		if ( ! geometry.boundingBox ) {

			geometry.boundingBox = new Box3();

		}

		if ( ! geometry.boundingSphere ) {

			geometry.boundingSphere = new Sphere();

		}

		if ( frustumCulled ) {

			const box = geometry.boundingBox;
			box.makeEmpty();

			for ( let i = 0, l = proxied.length; i < l; i ++ ) {

				box.expandByObject( proxied[ i ] );

			}
			// inverseMatrix.copy( matrixWorld ).invert();
			inverseMatrix.getInverse( matrixWorld );
			box.applyMatrix4( inverseMatrix );
			box.getBoundingSphere( geometry.boundingSphere );

		}

	}

}

class ProxyBone extends Bone {

	constructor( proxied ) {

		super();
		this.proxied = proxied;

	}

	updateMatrixWorld() {

		const { matrixWorld, proxied } = this;
		proxied.updateMatrixWorld( true );
		matrixWorld.copy( proxied.matrixWorld );

	}

}

export class ProxyBatchedMesh extends Group {

	get visible() {

		return this.proxied.visible;

	}

	set visible( v ) {

		if ( this.proxied ) {

			this.proxied.visible = v;

		}

	}

	constructor( root ) {

		super();

		if ( root.parent ) {

			throw new Error( 'ProxyBatchedMesh : Proxied root is not expected to have a parent.' );

		}

		// Set it's parent to this so the matrix world computations
		// account for this transform.
		root.parent = this;
		this.proxied = root;

		// Find all shared materials
		const materialToGeometry = new Map();
		root.updateMatrixWorld( true );
		root.traverse( c => {

			if ( c.isMesh ) {

				if ( Array.isArray( c.material ) ) {

					const materials = c.material;
					const hadIndex = Boolean( c.geometry.index );
					const geometry = hadIndex ? c.geometry.clone().toNonIndexed() : c.geometry;
					const groups = geometry.groups;
					const attributes = geometry.attributes;

					// for every group create a trimmed geometry that includes only the relevant indices
					groups.forEach( group => {

						const material = materials[ group.materialIndex ];
						if ( ! materialToGeometry.get( material ) ) {

							materialToGeometry.set( material, [] );

						}

						// create the trimmed attribute buffers
						const trimmedGeometry = new BufferGeometry();
						for ( const name in attributes ) {

							const attribute = attributes[ name ];
							const trimmedAttribute = new BufferAttribute(
								attribute.array.slice( group.start, group.start + group.count ),
								attribute.itemSize,
								attribute.normalized,
							);
							trimmedGeometry.setAttribute( name, trimmedAttribute );

						}

						// create a new index array if it already had one
						if ( hadIndex ) {

							const count = trimmedGeometry.attributes.position.count;
							const indexArray = new Array( count )
								.fill()
								.map( ( value, index ) => index );
							trimmedGeometry.setIndex( indexArray );

						}
						materialToGeometry.get( material ).push( {
							mesh: c,
							geometry: trimmedGeometry,
						} );

					} );

				} else {

					const material = c.material;
					if ( ! materialToGeometry.get( material ) ) {

						materialToGeometry.set( material, [] );

					}

					materialToGeometry.get( material ).push( {
						mesh: c,
						geometry: c.geometry,
					} );

				}

			}

		} );

		// Merge all geometries with common materials into a single proxy skinned mesh
		materialToGeometry.forEach( ( infoArray, material ) => {

			const weightCons = infoArray.length > 256 ? Uint16Array : Uint8Array;
			const bones = [];
			const geometries = infoArray.map( ( info, index ) => {

				console.log( info )
				const originalGeometry = info.geometry;
				const geometry = originalGeometry.clone();
				const count = geometry.attributes.position.count;

				const weights = new Uint8Array( count * 4 );
				for ( let i = 0, l = weights.length; i < l; i ++ ) {

					const i4 = i * 4;
					weights[ i4 ] = 255;
					weights[ i4 + 1 ] = 0;
					weights[ i4 + 2 ] = 0;
					weights[ i4 + 3 ] = 0;

				}
				geometry.setAttribute(
					'skinWeight',
					new BufferAttribute( weights, 4, true ),
				);
				geometry.setAttribute(
					'skinIndex',
					new BufferAttribute( new weightCons( count * 4 ).fill( index ), 4 ),
				);

				const bone = new ProxyBone( info.mesh );
				bones.push( bone );

				return geometry;

			} );

			material.skinning = true;
			const skeleton = new Skeleton( bones );
			const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries( geometries );

			const meshSet = new Set( infoArray.map( c => c.mesh ) );
			const skinnedMesh = new ProxySkinnedMesh( mergedGeometry, material, Array.from( meshSet ) );
			skinnedMesh.bind( skeleton );

			skinnedMesh.add( ...bones );
			this.add( skinnedMesh );

		} );

	}

	updateMatrixWorld( ...args ) {

		const { proxied } = this;
		if ( proxied.parent && proxied.parent !== this ) {

			console.warn( 'ProxyBatchedMesh : Proxy mesh is expected to not have parent.' );

		}

		if ( proxied.parent === null ) {

			proxied.parent = this;

		}
		this.updateWorldMatrix( false, false );
		proxied.updateMatrixWorld( ...args );
		return super.updateMatrixWorld( ...args );

	}

}
