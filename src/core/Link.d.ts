import { Frame } from './Frame';
import { Joint } from './Joint';

export class Link extends Frame {

	isLink : Boolean;
	closureJoints : Array<Joint>;

	addChild( child : Joint );

}
