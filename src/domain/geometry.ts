export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface Rect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** 上下左右の4方向。 */
export const DIRS4: readonly Point[] = [
	{ x: 0, y: -1 },
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: -1, y: 0 },
];

export function rectCenter(r: Rect): Point {
	return {
		x: r.x + Math.floor(r.width / 2),
		y: r.y + Math.floor(r.height / 2),
	};
}

export function rectContains(r: Rect, p: Point): boolean {
	return (
		p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height
	);
}

export function expandRect(r: Rect, margin: number): Rect {
	return {
		x: r.x - margin,
		y: r.y - margin,
		width: r.width + margin * 2,
		height: r.height + margin * 2,
	};
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
	return (
		a.x < b.x + b.width &&
		b.x < a.x + a.width &&
		a.y < b.y + b.height &&
		b.y < a.y + a.height
	);
}

export function manhattan(a: Point, b: Point): number {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function chebyshev(a: Point, b: Point): number {
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
