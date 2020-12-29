export function findRoots( frames ) {

	const potentialRoots = frames.map( f => {

		let lastParent = f;
		f.traverseParents( p => {

			lastParent = p;

		} );
		return lastParent;

	} );
	const roots = [];
	const set = new Set();

	for ( let i = 0; i < potentialRoots.length; i ++ ) {

		const frame = potentialRoots[ i ];

		// If this frame has already been traversed then we know it's in
		// a root already.
		if ( set.has( frame ) ) {

			continue;

		}

		roots.push( frame );
		frame.traverse( c => {

			if ( set.has( c ) ) {

				return true;

			}

			set.add( c );

			// If we come across a joint or link with closures traverse them
			// as far as possible to add them to the roots if they haven't been
			// added already.
			let closureConnections;
			if ( c.isLink ) {

				closureConnections = c.closureJoints;

			} else if ( c.isJoint && c.isClosure ) {

				closureConnections = [ c.child ];

			}

			if ( closureConnections ) {

				closureConnections.forEach( cl => {

					let lastParent = cl;
					cl.traverseParents( p => {

						lastParent = p;

					} );

					if ( ! set.has( lastParent ) ) {

						potentialRoots.push( lastParent );

					}

				} );

			}

		} );

	}

	return roots;

}
