import { Object3D } from 'three';
import { Link } from '../core/Link';

export function urdfRobotToIKRoot( urdfNode : Object3D, trimUnused : Boolean ) : Link;
export function setIKFromUrdf( ikRoot : Link, urdfRoot : Object3D ) : void;
export function setUrdfFromIK( urdfRoot : Object3D, ikRoot : Link ) : void;
