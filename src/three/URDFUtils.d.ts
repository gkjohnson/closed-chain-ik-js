import { Object3D } from 'three';
import { Link } from '../core/Link';
import { URDFRobot } from 'urdf-loader';

export function urdfRobotToIKRoot( urdfNode : URDFRobot, trimUnused? : Boolean ) : Link;
export function setIKFromUrdf( ikRoot : Link, urdfRoot : URDFRobot ) : void;
export function setUrdfFromIK( urdfRoot : URDFRobot, ikRoot : Link ) : void;
