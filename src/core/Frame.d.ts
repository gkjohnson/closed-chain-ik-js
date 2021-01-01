export class Frame {

	name : String;
	quaternion : Float32Array;
	position : Float32Array;

	matrix : Float32Array;
	matrixWorld : Float32Array;

	parent : Frame;
	children : Array<Frame>;

	setPosition( x : Number, y : Number, z : Number ) : void;
	setEuler( x : Number, y : Number, z : Number ) : void;
	setQuaternion( x : Number, y : Number, z : Number, w : Number ) : void;
	setWorldPosition( x : Number, y : Number, z : Number ) : void;
	setWorldEuler( x : Number, y : Number, z : Number ) : void;
	setWorldQuaternion( x : Number, y : Number, z : Number ) : void;

	getWorldPosition( array : Array<Number> ) : void;
	getWorldQuaternion( array : Array<Number> ) : void;

	traverseParents( cb : ( parent : Frame ) => Boolean ) : void;
	traverse( cb : ( child : Frame ) => Boolean ) : void;
	find( cb : ( child : Frame ) => Boolean ) : Frame;

	addChild( child : Frame ) : void;
	removeChild( child : Frame ) : void;

	attachChild( child : Frame ) : void;
	detachChild( child : Frame ) : void;

	computeMatrixWorld() : void;
	setMatrixNeedsUpdate() : void;
	setMatrixWorldNeedsUpdate() : void;
	updateMatrix() : void;
	updateMatrixWorld() : void;

}
