export function findRoots( frames ) {

	const roots = [];
	const set = new Set();

	frames.forEach( frame => {

		if ( set.has( frame ) ) {

			return;

		}

		roots.push( frame );
		frame.traverse( c => {

			if ( set.has( c ) ) {

				return true;

			}

			set.add( c );

			if ( c.isLink ) {

				const closureJoints = c.closureJoints;
				closureJoints.forEach( joint => {

					let lastParent = joint;
					joint.traverseParents( p => {

						lastParent = p;

					} );

					if ( ! set.has( lastParent ) ) {

						roots.push( lastParent );

					}

				} );

			}

		} );

	} );

	return roots;

}
