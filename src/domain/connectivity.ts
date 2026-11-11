import { DIRS4, type Point } from "./geometry.js";
import type { Grid } from "./grid.js";

/**
 * start から各床セルへの歩数を幅優先探索で求める。
 * blocked に含まれるセル(宝箱など)は通れない。到達不能は -1。
 */
export function distancesFrom(
	grid: Grid,
	start: Point,
	blocked: ReadonlySet<number> = new Set(),
): Int32Array {
	const dist = new Int32Array(grid.size).fill(-1);
	if (!grid.isFloor(start.x, start.y)) return dist;
	const startIndex = grid.indexOf(start);
	if (blocked.has(startIndex)) return dist;

	const queue = new Int32Array(grid.size);
	let head = 0;
	let tail = 0;
	queue[tail++] = startIndex;
	dist[startIndex] = 0;

	while (head < tail) {
		const current = queue[head++] as number;
		const cx = current % grid.width;
		const cy = Math.floor(current / grid.width);
		for (const d of DIRS4) {
			const nx = cx + d.x;
			const ny = cy + d.y;
			if (!grid.isFloor(nx, ny)) continue;
			const ni = grid.index(nx, ny);
			if (dist[ni] !== -1 || blocked.has(ni)) continue;
			dist[ni] = (dist[current] as number) + 1;
			queue[tail++] = ni;
		}
	}
	return dist;
}

/** 4近傍の床セル数。 */
export function floorNeighborCount(grid: Grid, p: Point): number {
	let count = 0;
	for (const d of DIRS4) {
		if (grid.isFloor(p.x + d.x, p.y + d.y)) count++;
	}
	return count;
}
