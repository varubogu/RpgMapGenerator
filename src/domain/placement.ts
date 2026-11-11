import { distancesFrom, floorNeighborCount } from "./connectivity.js";
import {
	chebyshev,
	manhattan,
	type Point,
	type Rect,
	rectContains,
} from "./geometry.js";
import type { Grid } from "./grid.js";
import type { Rng } from "./rng.js";
import { type Features, isPlayable } from "./validation.js";

export interface PlacementRequest {
	/** 省略時は自動で決める。 */
	readonly entrance?: Point;
	readonly exit: Point | "auto" | "none";
	/** undefined の要素は位置を自動で決める。 */
	readonly chests: ReadonlyArray<Point | undefined>;
}

/**
 * 位置が未指定の入口・出口・宝箱を配置する。
 * 破綻しない配置が見つからなければ undefined を返す(呼び出し側で作り直す)。
 */
export function placeFeatures(
	grid: Grid,
	rooms: readonly Rect[],
	request: PlacementRequest,
	rng: Rng,
): Features | undefined {
	const fixedChests = request.chests.filter((c): c is Point => c !== undefined);
	const blocked = new Set(fixedChests.map((c) => grid.indexOf(c)));
	const fixedExit = typeof request.exit === "object" ? request.exit : undefined;

	const reserved = new Set(blocked);
	if (request.entrance) reserved.add(grid.indexOf(request.entrance));
	if (fixedExit) reserved.add(grid.indexOf(fixedExit));
	const free = grid.floorCells().filter((p) => !reserved.has(grid.indexOf(p)));

	/** from から最も遠い空きマス。入口と出口を離して探索距離を稼ぐために使う。 */
	const farthestFrom = (from: Point, exclude?: Point): Point | undefined => {
		const dist = distancesFrom(grid, from, blocked);
		let best: Point | undefined;
		let bestDist = 0;
		for (const p of free) {
			if (exclude && p.x === exclude.x && p.y === exclude.y) continue;
			const d = dist[grid.indexOf(p)] as number;
			if (d > bestDist) {
				bestDist = d;
				best = p;
			}
		}
		return best;
	};

	let entrance = request.entrance;
	if (!entrance) {
		if (fixedExit) {
			entrance = farthestFrom(fixedExit);
		} else if (free.length > 0) {
			// 適当な点から最遠点を取ると、マップの「端」に近い点が得られる
			const probe = rng.pick(free);
			entrance = farthestFrom(probe) ?? probe;
		}
	}
	if (!entrance) return undefined;

	let exit = fixedExit;
	if (request.exit === "auto") {
		exit = farthestFrom(entrance, entrance);
		if (!exit) return undefined;
	}

	const chests: Point[] = [...fixedChests];
	const autoCount = request.chests.length - fixedChests.length;
	if (autoCount > 0) {
		const candidates = rankChestCandidates(grid, rooms, rng);
		const portals = exit ? [entrance, exit] : [entrance];
		for (let n = 0; n < autoCount; n++) {
			const found = candidates.find(
				(c) =>
					portals.every((p) => chebyshev(p, c) > 1) &&
					chests.every((o) => manhattan(o, c) > 1) &&
					isPlayable(grid, { entrance, exit, chests: [...chests, c] }),
			);
			if (!found) return undefined;
			chests.push(found);
		}
	}

	// 位置指定ありの宝箱を元の並び順に戻す
	const autoPlaced = chests.slice(fixedChests.length);
	const ordered = request.chests.map((c) => c ?? (autoPlaced.shift() as Point));
	return { entrance, exit, chests: ordered };
}

/**
 * 宝箱を置く候補を「それらしい」順に並べる。
 * 行き止まり → 部屋の壁際 → 部屋の中 → その他 の優先順。
 */
function rankChestCandidates(
	grid: Grid,
	rooms: readonly Rect[],
	rng: Rng,
): Point[] {
	const deadEnds: Point[] = [];
	const roomEdges: Point[] = [];
	const roomInner: Point[] = [];
	const others: Point[] = [];
	for (const p of grid.floorCells()) {
		const neighbors = floorNeighborCount(grid, p);
		if (neighbors === 1) deadEnds.push(p);
		else if (!rooms.some((r) => rectContains(r, p))) others.push(p);
		else if (neighbors < 4) roomEdges.push(p);
		else roomInner.push(p);
	}
	return [
		...rng.shuffle(deadEnds),
		...rng.shuffle(roomEdges),
		...rng.shuffle(roomInner),
		...rng.shuffle(others),
	];
}
