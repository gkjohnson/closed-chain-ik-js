import { Goal } from '../../src/core/Goal.js';
import { DOF } from '../../src/core/Joint.js';
import { Link } from '../../src/core/Link.js';

describe( 'Goal', () => {

	describe( 'setFreeDoF', () => {

		it( 'should set dof to the inverted DoF.', () => {

			const goal = new Goal();
			goal.setFreeDoF( DOF.X, DOF.Z );
			expect( goal.dof ).toEqual( [ DOF.Y, DOF.EX, DOF.EY, DOF.EZ ] );

			goal.setFreeDoF( DOF.X, DOF.EX, DOF.EY, DOF.EZ );
			expect( goal.dof ).toEqual( [ DOF.Y, DOF.Z ] );

		} );

	} );

	describe( 'setGoalDoF', () => {

		it( 'should set dof.', () => {

			const goal = new Goal();
			goal.setGoalDoF( DOF.X, DOF.Z );
			expect( goal.dof ).toEqual( [ DOF.X, DOF.Z ] );

		} );

		it( 'should fail if only a partial set of rotations are passed in.', () => {

			const goal = new Goal();
			let caught = false;
			try {

				goal.setGoalDoF( DOF.EX );

			} catch {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

	} );

	describe( 'addChild', () => {

		it( 'should not be abled to be called.', () => {

			const goal = new Goal();
			let caught;
			caught = false;
			try {

				goal.addChild( new Link() );

			} catch {

				caught = true;

			}

			expect( caught ).toBeTruthy();

			caught = false;
			try {

				goal.attachChild( new Link() );

			} catch {

				caught = true;

			}

			expect( caught ).toBeTruthy();

		} );

	} );

} );


