import type { Layout, LayoutGenerator, LayoutInput } from "../generator.js";
import {
	clamp,
	expandRect,
	manhattan,
	type Point,
	type Rect,
	rectCenter,
	rectsIntersect,
} from "../geometry.js";
import { Grid } from "../grid.js";
import type { Rng } from "../rng.js";

export interface RoomsOptions {
	/** 部屋数の目安。省略時はマップ面積から決める。 */
	readonly roomCount?: number;
	readonly minRoomSize: number;
	readonly maxRoomSize: number;
	/** 最小限の接続に加えて、回り道となる通路を足す確率(0〜1)。 */
	readonly loopChance: number;
}

const DEFAULTS: RoomsOptions = {
	minRoomSize: 4,
	maxRoomSize: 8,
	loopChance: 0.15,
};

/** 部屋同士の間に最低限空ける壁の厚み。 */
const ROOM_MARGIN = 2;

function numberOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function resolveRoomsOptions(
	raw: Readonly<Record<string, unknown>>,
): RoomsOptions {
	const roomCount =
		typeof raw.roomCount === "number" ? Math.floor(raw.roomCount) : undefined;
	return {
		roomCount,
		minRoomSize: Math.floor(numberOr(raw.minRoomSize, DEFAULTS.minRoomSize)),
		maxRoomSize: Math.floor(numberOr(raw.maxRoomSize, DEFAULTS.maxRoomSize)),
		loopChance: clamp(numberOr(raw.loopChance, DEFAULTS.loopChance), 0, 1),
	};
}

/**
 * 部屋を配置し、全域木で通路をつなぐ古典的な方式。
 * 全域木でつなぐため、構造上すべての部屋が必ず連結になる。
 */
export const roomsGenerator: LayoutGenerator = {
	name: "rooms",
	generate(input: LayoutInput, rng: Rng): Layout {
		const { width, height } = input;
		const options = resolveRoomsOptions(input.options);
		const grid = new Grid(width, height);

		const limit = Math.min(width, height) - 2;
		const minSize = clamp(options.minRoomSize, Math.min(3, limit), limit);
		const maxSize = clamp(options.maxRoomSize, minSize, limit);
		const randomSize = (max: number): number =>
			rng.int(Math.min(minSize, max), Math.min(maxSize, max));

		const rooms: Rect[] = [];

		// 指定地点は、それを内側に含む部屋を必ず作る
		for (const anchor of input.anchors) {
			const w = randomSize(width - 2);
			const h = randomSize(height - 2);
			const offsetX = w >= 3 ? rng.int(1, w - 2) : rng.int(0, w - 1);
			const offsetY = h >= 3 ? rng.int(1, h - 2) : rng.int(0, h - 1);
			rooms.push({
				x: clamp(anchor.x - offsetX, 1, width - 1 - w),
				y: clamp(anchor.y - offsetY, 1, height - 1 - h),
				width: w,
				height: h,
			});
		}

		const target =
			options.roomCount ?? clamp(Math.round((width * height) / 160), 2, 40);
		let tries = Math.max(target, 1) * 40;
		while (rooms.length < target && tries-- > 0) {
			const w = randomSize(width - 2);
			const h = randomSize(height - 2);
			const candidate: Rect = {
				x: rng.int(1, width - 1 - w),
				y: rng.int(1, height - 1 - h),
				width: w,
				height: h,
			};
			const crowded = rooms.some((room) =>
				rectsIntersect(expandRect(room, ROOM_MARGIN), candidate),
			);
			if (!crowded) rooms.push(candidate);
		}

		for (const room of rooms) carveRect(grid, room);

		const centers = rooms.map(rectCenter);
		const linked = new Set<string>();
		const link = (a: number, b: number): void => {
			linked.add(a < b ? `${a}:${b}` : `${b}:${a}`);
			carveCorridor(grid, centers[a] as Point, centers[b] as Point, rng);
		};
		const isLinked = (a: number, b: number): boolean =>
			linked.has(a < b ? `${a}:${b}` : `${b}:${a}`);

		for (const [a, b] of spanningTree(centers)) link(a, b);

		// 回り道: 各部屋から、まだ直接つながっていない最寄りの部屋へ確率的に通路を足す
		for (let a = 0; a < centers.length; a++) {
			let nearest = -1;
			let best = Number.POSITIVE_INFINITY;
			for (let b = 0; b < centers.length; b++) {
				if (a === b || isLinked(a, b)) continue;
				const d = manhattan(centers[a] as Point, centers[b] as Point);
				if (d < best) {
					best = d;
					nearest = b;
				}
			}
			if (nearest >= 0 && rng.chance(options.loopChance)) link(a, nearest);
		}

		return { grid, rooms };
	},
};

function carveRect(grid: Grid, rect: Rect): void {
	for (let y = rect.y; y < rect.y + rect.height; y++) {
		for (let x = rect.x; x < rect.x + rect.width; x++) grid.carve(x, y);
	}
}

/** L字型の通路を掘る。縦横どちらを先に進むかは乱数で決める。 */
function carveCorridor(grid: Grid, from: Point, to: Point, rng: Rng): void {
	const horizontal = (y: number): void => {
		for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) {
			grid.carve(x, y);
		}
	};
	const vertical = (x: number): void => {
		for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) {
			grid.carve(x, y);
		}
	};
	if (rng.chance(0.5)) {
		horizontal(from.y);
		vertical(to.x);
	} else {
		vertical(from.x);
		horizontal(to.y);
	}
}

/** プリム法による最小全域木。辺を [接続済み側, 新規側] の添字ペアで返す。 */
function spanningTree(points: readonly Point[]): Array<[number, number]> {
	const edges: Array<[number, number]> = [];
	if (points.length < 2) return edges;
	const inTree = new Array<boolean>(points.length).fill(false);
	const cost = new Array<number>(points.length).fill(Number.POSITIVE_INFINITY);
	const parent = new Array<number>(points.length).fill(-1);
	cost[0] = 0;

	for (let n = 0; n < points.length; n++) {
		let next = -1;
		for (let i = 0; i < points.length; i++) {
			if (inTree[i]) continue;
			if (next === -1 || (cost[i] as number) < (cost[next] as number)) next = i;
		}
		inTree[next] = true;
		const from = parent[next] as number;
		if (from >= 0) edges.push([from, next]);
		for (let i = 0; i < points.length; i++) {
			if (inTree[i]) continue;
			const d = manhattan(points[next] as Point, points[i] as Point);
			if (d < (cost[i] as number)) {
				cost[i] = d;
				parent[i] = next;
			}
		}
	}
	return edges;
}
