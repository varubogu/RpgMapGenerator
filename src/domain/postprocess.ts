import type { Point } from "./geometry.js";
import type { Grid } from "./grid.js";

/**
 * 地点の周囲8マスを床にする。
 *
 * 宝箱は通行不可なので、通路の途中に置かれると道を塞いでしまう。周囲8マスが
 * 床であれば宝箱を迂回できるため、その宝箱単体が道を分断することはなくなる。
 */
export function openAround(grid: Grid, p: Point): void {
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) grid.carve(p.x + dx, p.y + dy);
	}
}

/**
 * 上下を床に挟まれた厚さ1マスの壁を床にする。
 *
 * ツクールの見下ろし表現では、床のすぐ上の壁セルに「壁の側面」を描く。厚さ1マス
 * の壁は上の部屋から見ると側面の裏側が見えてしまい不自然なので、あらかじめ均す。
 * 床を増やすだけなので連結性は壊れない。
 */
export function removeThinWalls(grid: Grid): void {
	const targets: Point[] = [];
	for (let y = 1; y < grid.height - 1; y++) {
		for (let x = 1; x < grid.width - 1; x++) {
			if (
				!grid.isFloor(x, y) &&
				grid.isFloor(x, y - 1) &&
				grid.isFloor(x, y + 1)
			) {
				targets.push({ x, y });
			}
		}
	}
	for (const p of targets) grid.carve(p.x, p.y);
}
