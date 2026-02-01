export const PI = Math.PI;
export const PI2 = 2 * PI;
export const HALF_PI = PI / 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 1 / DEG2RAD;
export const AXES = [
	new Float64Array( [ 1, 0, 0 ] ), // X
	new Float64Array( [ 0, 1, 0 ] ), // Y
	new Float64Array( [ 0, 0, 1 ] ), // Z
	new Float64Array( [ 1, 0, 0 ] ), // EX (rotation around X)
	new Float64Array( [ 0, 1, 0 ] ), // EY (rotation around Y)
	new Float64Array( [ 0, 0, 1 ] ), // EZ (rotation around Z)
];
